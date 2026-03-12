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

postsController.redirectToPost = async function (req, res, next) {
	const { pid: rawPid } = req.params;
	const pid = utils.isNumber(rawPid) ? parseInt(rawPid, 10) : rawPid;

	if (!pid) {
		return next();
	}

	const isNumericPid = utils.isNumber(pid);
	const { activitypubEnabled } = meta.config;

	// Kickstart note assertion if applicable
	if (!isNumericPid && req.uid && activitypubEnabled) {
		const exists = await posts.exists(pid);
		if (!exists) {
			await activitypub.notes.assert(req.uid, pid);
		}
	}

	const canReadPromise = privileges.posts.can('topics:read', pid, req.uid);
	const pathPromise = posts.generatePostPath(pid, req.uid);

	const [canRead, path] = await Promise.all([canReadPromise, pathPromise]);

	if (!path) {
		return next();
	}

	if (!canRead) {
		return helpers.notAllowed(req, res);
	}

	if (activitypubEnabled) {
		res.set(
			'Link',
			`<${nconf.get('url')}/post/${rawPid}>; rel="alternate"; type="application/activity+json"`
		);
	}

	const qs = querystring.stringify(req.query);
	const redirectPath = qs ? `${path}?${qs}` : path;

	helpers.redirect(res, redirectPath, true);
};
