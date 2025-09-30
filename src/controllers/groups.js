'use strict';

const validator = require('validator');
const nconf = require('nconf');

const meta = require('../meta');
const groups = require('../groups');
const user = require('../user');
const helpers = require('./helpers');
const pagination = require('../pagination');
const privileges = require('../privileges');

const groupsController = module.exports;

const url = nconf.get('url');

groupsController.list = async function (req, res) {
	const sort = req.query.sort || 'alpha';
	const page = parseInt(req.query.page, 10) || 1;
	const [allowGroupCreation, [groupData, pageCount]] = await Promise.all([
		privileges.global.can('group:create', req.uid),
		getGroups(req, sort, page),
	]);

	res.locals.linkTags = [
		{
			rel: 'canonical',
			href: `${url}${req.url.replace(/^\/api/, '')}`,
		},
	];

	res.render('groups/list', {
		groups: groupData,
		allowGroupCreation: allowGroupCreation,
		sort: validator.escape(String(sort)),
		pagination: pagination.create(page, pageCount, req.query),
		title: '[[pages:groups]]',
		breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[pages:groups]]' }]),
	});
};

async function getGroups(req, sort, page) {
	const resultsPerPage = req.query.query ? 100 : 15;
	const start = Math.max(0, page - 1) * resultsPerPage;
	const stop = start + resultsPerPage - 1;

	if (req.query.query) {
		const filterHidden = req.query.filterHidden === 'true' || !await user.isAdministrator(req.uid);
		const groupData = await groups.search(req.query.query, {
			sort,
			filterHidden: filterHidden,
			showMembers: req.query.showMembers === 'true',
			hideEphemeralGroups: req.query.hideEphemeralGroups === 'true',
			excludeGroups: Array.isArray(req.query.excludeGroups) ? req.query.excludeGroups : [],
		});
		const pageCount = Math.ceil(groupData.length / resultsPerPage);

		return [groupData.slice(start, stop + 1), pageCount];
	}

	const [groupData, groupCount] = await Promise.all([
		groups.getGroupsBySort(sort, start, stop),
		groups.getGroupCountBySort(sort),
	]);

	const pageCount = Math.ceil(groupCount / resultsPerPage);
	return [groupData, pageCount];
}

async function handleSlugNormalization(req, res) {
	const lowercaseSlug = req.params.slug.toLowerCase();
	if (req.params.slug !== lowercaseSlug) {
		if (res.locals.isAPI) {
			req.params.slug = lowercaseSlug;
		} else {
			return { shouldRedirect: true, redirectUrl: `${nconf.get('relative_path')}/groups/${lowercaseSlug}` };
		}
	}
	return { shouldRedirect: false, slug: lowercaseSlug };
}

async function validateGroupAccess(groupName, uid) {
	const [exists, isHidden, isAdmin, isGlobalMod] = await Promise.all([
		groups.exists(groupName),
		groups.isHidden(groupName),
		privileges.admin.can('admin:groups', uid),
		user.isGlobalModerator(uid),
	]);

	if (!exists) {
		return { hasAccess: false };
	}

	if (isHidden && !isAdmin && !isGlobalMod) {
		const [isMember, isInvited] = await Promise.all([
			groups.isMember(uid, groupName),
			groups.isInvited(uid, groupName),
		]);
		if (!isMember && !isInvited) {
			return { hasAccess: false };
		}
	}

	return { hasAccess: true, isAdmin, isGlobalMod };
}

async function fetchGroupData(groupName, uid) {
	const [groupData, posts] = await Promise.all([
		groups.get(groupName, {
			uid: uid,
			truncateUserList: true,
			userListCount: 20,
		}),
		groups.getLatestMemberPosts(groupName, 10, uid),
	]);

	if (!groupData) {
		return null;
	}

	return { groupData, posts };
}

groupsController.details = async function (req, res, next) {
	console.log('mmingus'); // Temporary log for testing
	
	// Handle slug normalization
	const slugResult = await handleSlugNormalization(req, res);
	if (slugResult.shouldRedirect) {
		return res.redirect(slugResult.redirectUrl);
	}
	const lowercaseSlug = slugResult.slug || req.params.slug.toLowerCase();

	// Get group name and validate it exists
	const groupName = await groups.getGroupNameByGroupSlug(req.params.slug);
	if (!groupName) {
		return next();
	}

	// Validate access permissions
	const accessResult = await validateGroupAccess(groupName, req.uid);
	if (!accessResult.hasAccess) {
		return next();
	}

	// Fetch group data and posts
	const dataResult = await fetchGroupData(groupName, req.uid);
	if (!dataResult) {
		return next();
	}

	// Set canonical link
	res.locals.linkTags = [
		{
			rel: 'canonical',
			href: `${url}/groups/${lowercaseSlug}`,
		},
	];

	// Render the page
	res.render('groups/details', {
		title: `[[pages:group, ${dataResult.groupData.displayName}]]`,
		group: dataResult.groupData,
		posts: dataResult.posts,
		isAdmin: accessResult.isAdmin,
		isGlobalMod: accessResult.isGlobalMod,
		allowPrivateGroups: meta.config.allowPrivateGroups,
		breadcrumbs: helpers.buildBreadcrumbs([
			{ text: '[[pages:groups]]', url: '/groups' }, 
			{ text: dataResult.groupData.displayName },
		]),
	});
};

groupsController.members = async function (req, res, next) {
	const page = parseInt(req.query.page, 10) || 1;
	const usersPerPage = 50;
	const start = Math.max(0, (page - 1) * usersPerPage);
	const stop = start + usersPerPage - 1;
	const groupName = await groups.getGroupNameByGroupSlug(req.params.slug);
	if (!groupName) {
		return next();
	}
	const [groupData, isAdminOrGlobalMod, isMember, isHidden] = await Promise.all([
		groups.getGroupData(groupName),
		user.isAdminOrGlobalMod(req.uid),
		groups.isMember(req.uid, groupName),
		groups.isHidden(groupName),
	]);

	if (isHidden && !isMember && !isAdminOrGlobalMod) {
		return next();
	}
	const users = await user.getUsersFromSet(`group:${groupName}:members`, req.uid, start, stop);

	const breadcrumbs = helpers.buildBreadcrumbs([
		{ text: '[[pages:groups]]', url: '/groups' },
		{ text: validator.escape(String(groupName)), url: `/groups/${req.params.slug}` },
		{ text: '[[groups:details.members]]' },
	]);

	const pageCount = Math.max(1, Math.ceil(groupData.memberCount / usersPerPage));
	res.render('groups/members', {
		users: users,
		pagination: pagination.create(page, pageCount, req.query),
		breadcrumbs: breadcrumbs,
	});
};
