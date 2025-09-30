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

// Helper: fetch existence / visibility / privileges for a group
async function _getGroupAccessMeta(groupName, uid) {
	const [exists, isHidden, isAdmin, isGlobalMod] = await Promise.all([
		groups.exists(groupName),
		groups.isHidden(groupName),
		privileges.admin.can('admin:groups', uid),
		user.isGlobalModerator(uid),
	]);

	return { exists, isHidden, isAdmin, isGlobalMod };
}

// Helper: determine if a user may view a hidden group
async function _canAccessHiddenGroup(uid, groupName) {
	const [isMember, isInvited] = await Promise.all([
		groups.isMember(uid, groupName),
		groups.isInvited(uid, groupName),
	]);
	return isMember || isInvited;
}

// Prepare all data and permission checks for rendering group details.
// Returns null if the request should result in a 404/next().
async function _prepareGroupForRender(req) {
	const lowercaseSlug = req.params.slug.toLowerCase();
	// Caller should handle redirect when slug case differs; normalize for lookups here
	if (req.params.slug !== lowercaseSlug) {
		req.params.slug = lowercaseSlug;
	}

	const groupName = await groups.getGroupNameByGroupSlug(req.params.slug);
	if (!groupName) {
		return null;
	}

	const { exists, isHidden, isAdmin, isGlobalMod } = await _getGroupAccessMeta(groupName, req.uid);
	if (!exists) {
		return null;
	}

	if (isHidden && !isAdmin && !isGlobalMod) {
		const allowed = await _canAccessHiddenGroup(req.uid, groupName);
		if (!allowed) {
			return null;
		}
	}

	const [groupData, posts] = await Promise.all([
		groups.get(groupName, {
			uid: req.uid,
			truncateUserList: true,
			userListCount: 20,
		}),
		groups.getLatestMemberPosts(groupName, 10, req.uid),
	]);

	if (!groupData) {
		return null;
	}

	return { groupName, groupData, posts, isAdmin, isGlobalMod };
}

groupsController.details = async function (req, res, next) {
	const lowercaseSlug = req.params.slug.toLowerCase();
	if (req.params.slug !== lowercaseSlug) {
		if (res.locals.isAPI) {
			req.params.slug = lowercaseSlug;
		} else {
			return res.redirect(`${nconf.get('relative_path')}/groups/${lowercaseSlug}`);
		}
	}

	const prepared = await _prepareGroupForRender(req);

	if (!prepared) {
		return next();
	}

	const { groupData, posts, isAdmin, isGlobalMod } = prepared;

	res.locals.linkTags = [
		{
			rel: 'canonical',
			href: `${url}/groups/${lowercaseSlug}`,
		},
	];

	res.render('groups/details', {
		title: `[[pages:group, ${groupData.displayName}]]`,
		group: groupData,
		posts: posts,
		isAdmin: isAdmin,
		isGlobalMod: isGlobalMod,
		allowPrivateGroups: meta.config.allowPrivateGroups,
		breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[pages:groups]]', url: '/groups' }, { text: groupData.displayName }]),
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
