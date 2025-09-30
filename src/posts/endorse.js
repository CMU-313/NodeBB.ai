'use strict';

const user = require('../user');
const privileges = require('../privileges');
const plugins = require('../plugins');

module.exports = function (Posts) {
	Posts.endorse = async function (pid, uid) {
		return await toggleEndorse(pid, uid, true);
	};

	Posts.unendorse = async function (pid, uid) {
		return await toggleEndorse(pid, uid, false);
	};

	Posts.hasEndorsed = async function (pid, uid) {
		const postData = await Posts.getPostFields(pid, ['endorsed', 'endorsedBy']);
		return postData && parseInt(postData.endorsed, 10) === 1 && parseInt(postData.endorsedBy, 10) === parseInt(uid, 10);
	};

	Posts.canEndorse = async function (pid, uid) {
		if (parseInt(uid, 10) <= 0) {
			return { flag: false, message: '[[error:not-logged-in]]' };
		}

		const [postData, isPrivileged] = await Promise.all([
			Posts.getPostFields(pid, ['uid', 'tid']),
			user.isPrivileged(uid),
		]);

		if (!postData) {
			return { flag: false, message: '[[error:no-post]]' };
		}

		// Only privileged users (admins, global mods, category mods) can endorse
		if (!isPrivileged) {
			return { flag: false, message: '[[error:no-privileges]]' };
		}

		// Users cannot endorse their own posts
		if (parseInt(postData.uid, 10) === parseInt(uid, 10)) {
			return { flag: false, message: '[[error:cannot-endorse-own-post]]' };
		}

		// Check if user has privileges to read the topic
		const canRead = await privileges.posts.can('topics:read', pid, uid);
		if (!canRead) {
			return { flag: false, message: '[[error:no-privileges]]' };
		}

		return { flag: true, message: '' };
	};

	async function toggleEndorse(pid, uid, endorse) {
		const canEndorse = await Posts.canEndorse(pid, uid);
		if (!canEndorse.flag) {
			throw new Error(canEndorse.message);
		}

		const isEndorsed = await Posts.hasEndorsed(pid, uid);
		if (isEndorsed === endorse) {
			throw new Error(endorse ? '[[error:already-endorsed]]' : '[[error:not-endorsed]]');
		}

		const endorseData = {
			endorsed: endorse ? 1 : 0,
			endorsedBy: endorse ? uid : 0,
			endorsedTimestamp: endorse ? Date.now() : 0,
		};

		await Posts.setPostFields(pid, endorseData);

		// Fire plugin hooks
		const hookData = {
			pid: pid,
			uid: uid,
			endorserUid: uid,
			endorsed: endorse,
		};

		await plugins.hooks.fire(endorse ? 'action:post.endorse' : 'action:post.unendorse', hookData);

		return await Posts.getPostData(pid);
	}
};