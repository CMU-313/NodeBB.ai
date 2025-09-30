'use strict';

const _ = require('lodash');
const validator = require('validator');

const user = require('../user');
const groups = require('../groups');
const meta = require('../meta');
const posts = require('../posts');
const db = require('../database');
const flags = require('../flags');
const analytics = require('../analytics');
const plugins = require('../plugins');
const pagination = require('../pagination');
const privileges = require('../privileges');
const utils = require('../utils');
const helpers = require('./helpers');

const modsController = module.exports;
modsController.flags = {};

// Helper function to validate user permissions and setup access control
async function validateFlagsAccess(uid) {
	const results = await Promise.all([
		user.isAdminOrGlobalMod(uid),
		user.getModeratedCids(uid),
	]);
	const [isAdminOrGlobalMod, moderatedCids] = results;

	if (!(isAdminOrGlobalMod || !!moderatedCids.length)) {
		return { hasAccess: false };
	}

	return {
		hasAccess: true,
		isAdminOrGlobalMod,
		moderatedCids,
		allowedCids: !isAdminOrGlobalMod && moderatedCids.length ? moderatedCids.map(cid => String(cid)) : null,
	};
}

// Helper function to parse and validate filters from query parameters
function parseQueryFilters(query, validFilters) {
	return validFilters.reduce((memo, cur) => {
		if (query.hasOwnProperty(cur)) {
			if (typeof query[cur] === 'string' && query[cur].trim() !== '') {
				memo[cur] = validator.escape(String(query[cur].trim()));
			} else if (Array.isArray(query[cur]) && query[cur].length) {
				memo[cur] = query[cur].map(item => validator.escape(String(item).trim()));
			}
		}
		return memo;
	}, {});
}

// Helper function to apply category restrictions for moderators
function applyCategoryRestrictions(filters, allowedCids) {
	if (!allowedCids) {
		return filters;
	}

	const updatedFilters = { ...filters };
	let hasFilter = !!Object.keys(filters).length;

	if (!updatedFilters.cid) {
		// If mod and no cid filter, add filter for their modded categories
		updatedFilters.cid = allowedCids;
	} else if (Array.isArray(updatedFilters.cid)) {
		// Remove cids they do not moderate
		updatedFilters.cid = updatedFilters.cid.filter(cid => allowedCids.includes(String(cid)));
	} else if (!allowedCids.includes(String(updatedFilters.cid))) {
		updatedFilters.cid = allowedCids;
		hasFilter = false;
	}

	return { filters: updatedFilters, hasFilter };
}

// Helper function to determine if pagination-only filters count as "no filter"
function isPaginationOnlyFilter(filters) {
	const keys = Object.keys(filters);
	return (
		(keys.length === 1 && filters.hasOwnProperty('page')) ||
		(keys.length === 2 && filters.hasOwnProperty('page') && filters.hasOwnProperty('perPage'))
	);
}

// Helper function to parse and validate sort parameters
function parseSortParameter(query, validSorts) {
	if (!query.sort) {
		return { sort: undefined, hasSort: false };
	}

	let sort = validSorts.includes(query.sort) ? query.sort : null;
	if (sort === 'newest') {
		sort = undefined;
	}

	return { sort, hasSort: !!sort };
}

// Helper function to build selected user data for filters
async function buildSelectedUserData(filters) {
	const selected = {};
	await Promise.all(['assignee', 'reporterId', 'targetUid'].map(async (filter) => {
		let uids = filters[filter];
		if (!uids) {
			selected[filter] = [];
			return;
		}
		if (!Array.isArray(uids)) {
			uids = [uids];
		}

		selected[filter] = await user.getUsersFields(uids, ['username', 'userslug', 'picture']);
	}));
	return selected;
}

modsController.flags.list = async function (req, res) {
	const validFilters = ['assignee', 'state', 'reporterId', 'type', 'targetUid', 'cid', 'quick', 'page', 'perPage'];
	const validSorts = ['newest', 'oldest', 'reports', 'upvotes', 'downvotes', 'replies'];

	// Validate user access and permissions
	const accessInfo = await validateFlagsAccess(req.uid);
	if (!accessInfo.hasAccess) {
		return helpers.notAllowed(req, res);
	}

	// Setup allowed categories for moderators
	if (accessInfo.allowedCids) {
		res.locals.cids = accessInfo.allowedCids;
	}

	// Get validated filters and sorts from plugins
	const [{ filters: validatedFilters }, { sorts }] = await Promise.all([
		plugins.hooks.fire('filter:flags.validateFilters', { filters: validFilters }),
		plugins.hooks.fire('filter:flags.validateSort', { sorts: validSorts }),
	]);

	// Parse query parameters into filters
	let filters = parseQueryFilters(req.query, validatedFilters);
	let hasFilter = !!Object.keys(filters).length;

	// Apply category restrictions for moderators
	if (accessInfo.allowedCids) {
		const result = applyCategoryRestrictions(filters, accessInfo.allowedCids);
		filters = result.filters;
		if (result.hasFilter !== undefined) {
			hasFilter = result.hasFilter;
		}
	}

	// Check if only pagination parameters are present
	if (isPaginationOnlyFilter(filters)) {
		hasFilter = false;
	}

	// Parse sort parameter
	const { sort, hasSort } = parseSortParameter(req.query, sorts);
	hasFilter = hasFilter || hasSort;

	// Fetch all required data in parallel
	const [flagsData, analyticsData, selectData, selected] = await Promise.all([
		flags.list({
			filters: filters,
			sort: sort,
			uid: req.uid,
			query: req.query,
		}),
		analytics.getDailyStatsForSet('analytics:flags', Date.now(), 30),
		helpers.getSelectedCategory(filters.cid),
		buildSelectedUserData(filters),
	]);

	res.render('flags/list', {
		flags: flagsData.flags,
		count: flagsData.count,
		analytics: analyticsData,
		selectedCategory: selectData.selectedCategory,
		selected,
		hasFilter: hasFilter,
		filters: filters,
		expanded: !!(filters.assignee || filters.reporterId || filters.targetUid),
		sort: sort || 'newest',
		title: '[[pages:flags]]',
		pagination: pagination.create(flagsData.page, flagsData.pageCount, req.query),
		breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[pages:flags]]' }]),
	});
};

modsController.flags.detail = async function (req, res, next) {
	const results = await utils.promiseParallel({
		isAdminOrGlobalMod: user.isAdminOrGlobalMod(req.uid),
		moderatedCids: user.getModeratedCids(req.uid),
		flagData: flags.get(req.params.flagId),
		privileges: Promise.all(['global', 'admin'].map(async type => privileges[type].get(req.uid))),
	});
	results.privileges = { ...results.privileges[0], ...results.privileges[1] };
	if (!results.flagData || (!(results.isAdminOrGlobalMod || !!results.moderatedCids.length))) {
		return next(); // 404
	}

	// extra checks for plain moderators
	if (!results.isAdminOrGlobalMod) {
		if (results.flagData.type === 'user') {
			return next();
		}
		if (results.flagData.type === 'post') {
			const isFlagInModeratedCids = await db.isMemberOfSortedSets(
				results.moderatedCids.map(cid => `flags:byCid:${cid}`),
				results.flagData.flagId
			);
			if (!isFlagInModeratedCids.includes(true)) {
				return next();
			}
		}
	}


	async function getAssignees(flagData) {
		let uids = [];
		const [admins, globalMods] = await Promise.all([
			groups.getMembers('administrators', 0, -1),
			groups.getMembers('Global Moderators', 0, -1),
		]);
		if (flagData.type === 'user') {
			uids = await privileges.admin.getUidsWithPrivilege('admin:users');
			uids = _.uniq(admins.concat(uids));
		} else if (flagData.type === 'post') {
			const cid = await posts.getCidByPid(flagData.targetId);
			uids = _.uniq(admins.concat(globalMods));
			if (cid) {
				const modUids = (await privileges.categories.getUidsWithPrivilege([cid], 'moderate'))[0];
				uids = _.uniq(uids.concat(modUids));
			}
		}
		const userData = await user.getUsersData(uids);
		return userData.filter(u => u && u.userslug);
	}

	const assignees = await getAssignees(results.flagData);
	results.flagData.history = await flags.getHistory(req.params.flagId);

	if (results.flagData.type === 'user') {
		results.flagData.type_path = 'uid';
	} else if (results.flagData.type === 'post') {
		results.flagData.type_path = 'post';
	}

	res.render('flags/detail', Object.assign(results.flagData, {
		assignees: assignees,
		type_bool: ['post', 'user', 'empty'].reduce((memo, cur) => {
			if (cur !== 'empty') {
				memo[cur] = results.flagData.type === cur && (
					!results.flagData.target ||
					!!Object.keys(results.flagData.target).length
				);
			} else {
				memo[cur] = !Object.keys(results.flagData.target).length;
			}

			return memo;
		}, {}),
		states: Object.fromEntries(flags._states),
		title: `[[pages:flag-details, ${req.params.flagId}]]`,
		privileges: results.privileges,
		breadcrumbs: helpers.buildBreadcrumbs([
			{ text: '[[pages:flags]]', url: '/flags' },
			{ text: `[[pages:flag-details, ${req.params.flagId}]]` },
		]),
	}));
};

modsController.postQueue = async function (req, res, next) {
	if (!req.loggedIn) {
		return next();
	}
	const { id } = req.params;
	const { cid } = req.query;
	const page = parseInt(req.query.page, 10) || 1;
	const postsPerPage = 20;

	let postData = await posts.getQueuedPosts({ id: id });
	let [isAdmin, isGlobalMod, moderatedCids, categoriesData, _privileges] = await Promise.all([
		user.isAdministrator(req.uid),
		user.isGlobalModerator(req.uid),
		user.getModeratedCids(req.uid),
		helpers.getSelectedCategory(cid),
		Promise.all(['global', 'admin'].map(async type => privileges[type].get(req.uid))),
	]);
	_privileges = { ..._privileges[0], ..._privileges[1] };

	postData = postData
		.filter(p => p &&
			(!categoriesData.selectedCids.length || categoriesData.selectedCids.includes(p.category.cid)) &&
			(isAdmin || isGlobalMod || moderatedCids.includes(Number(p.category.cid)) || req.uid === p.user.uid))
		.map((post) => {
			const isSelf = post.user.uid === req.uid;
			post.canAccept = !isSelf && (isAdmin || isGlobalMod || !!moderatedCids.length);
			post.canEdit = isSelf || isAdmin || isGlobalMod;
			return post;
		});

	({ posts: postData } = await plugins.hooks.fire('filter:post-queue.get', {
		posts: postData,
		req: req,
	}));

	const pageCount = Math.max(1, Math.ceil(postData.length / postsPerPage));
	const start = (page - 1) * postsPerPage;
	const stop = start + postsPerPage - 1;
	postData = postData.slice(start, stop + 1);
	const crumbs = [{ text: '[[pages:post-queue]]', url: id ? '/post-queue' : undefined }];
	if (id && postData.length) {
		const text = postData[0].data.tid ? '[[post-queue:reply]]' : '[[post-queue:topic]]';
		crumbs.push({ text: text });
	}
	res.render('post-queue', {
		title: '[[pages:post-queue]]',
		posts: postData,
		isAdmin: isAdmin,
		canAccept: isAdmin || isGlobalMod,
		...categoriesData,
		allCategoriesUrl: `post-queue${helpers.buildQueryString(req.query, 'cid', '')}`,
		pagination: pagination.create(page, pageCount),
		breadcrumbs: helpers.buildBreadcrumbs(crumbs),
		enabled: meta.config.postQueue,
		singlePost: !!id,
		privileges: _privileges,
	});
};
