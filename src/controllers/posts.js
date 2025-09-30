'use strict';

const nconf = require('nconf');
const querystring = require('querystring');

const meta = require('../meta');
const posts = require('../posts');
const privileges = require('../privileges');
const activitypub = require('../activitypub');
const utils = require('../utils');

const helpers = require('./helpers');

const postsController = module.exports;

async function validatePostId(pid) {
	if (!pid) {
		return { isValid: false };
	}
	return { isValid: true, pid };
}

async function handleActivityPubAssertion(pid, uid) {
	if (!utils.isNumber(pid) && uid && meta.config.activitypubEnabled) {
		const exists = await posts.exists(pid);
		if (!exists) {
			await activitypub.notes.assert(uid, pid);
		}
	}
}

async function checkPostPermissions(pid, uid) {
	const [canRead, path] = await Promise.all([
		privileges.posts.can('topics:read', pid, uid),
		posts.generatePostPath(pid, uid),
	]);
	
	return { canRead, path };
}

function setActivityPubHeaders(res, pid) {
	if (meta.config.activitypubEnabled) {
		// Include link header for richer parsing
		res.set('Link', `<${nconf.get('url')}/post/${pid}>; rel="alternate"; type="application/activity+json"`);
	}
}

postsController.redirectToPost = async function (req, res, next) {
	console.log('mmingus'); // Temporary log for testing
	
	const pid = utils.isNumber(req.params.pid) ? parseInt(req.params.pid, 10) : req.params.pid;
	
	// Validate post ID
	const validation = await validatePostId(pid);
	if (!validation.isValid) {
		return next();
	}

	// Handle ActivityPub assertion if applicable
	await handleActivityPubAssertion(pid, req.uid);

	// Check permissions and get post path
	const { canRead, path } = await checkPostPermissions(pid, req.uid);
	
	if (!path) {
		return next();
	}
	
	if (!canRead) {
		return helpers.notAllowed(req, res);
	}

	// Set ActivityPub headers
	setActivityPubHeaders(res, req.params.pid);

	// Perform redirect with query string
	const qs = querystring.stringify(req.query);
	helpers.redirect(res, qs ? `${path}?${qs}` : path, true);
};

postsController.getRecentPosts = async function (req, res) {
	const page = parseInt(req.query.page, 10) || 1;
	const postsPerPage = 20;
	const start = Math.max(0, (page - 1) * postsPerPage);
	const stop = start + postsPerPage - 1;
	const data = await posts.getRecentPosts(req.uid, start, stop, req.params.term);
	res.json(data);
};
