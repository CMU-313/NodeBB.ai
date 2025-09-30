'use strict';

const privileges = require('../privileges');
const events = require('../events');
const plugins = require('../plugins');
const _ = require('lodash');

module.exports = function (Posts) {
	Posts.tools = {};

	Posts.tools.delete = async function (uid, pid) {
		return await togglePostDelete(uid, pid, true);
	};

	Posts.tools.restore = async function (uid, pid) {
		return await togglePostDelete(uid, pid, false);
	};

	Posts.tools.pin = async function (uid, pid) {
		return await togglePostPin(uid, pid, true);
	};

	Posts.tools.unpin = async function (uid, pid) {
		return await togglePostPin(uid, pid, false);
	};

	async function togglePostDelete(uid, pid, isDelete) {
		const [postData, canDelete] = await Promise.all([
			Posts.getPostData(pid),
			privileges.posts.canDelete(pid, uid),
		]);
		if (!postData) {
			throw new Error('[[error:no-post]]');
		}

		if (postData.deleted && isDelete) {
			throw new Error('[[error:post-already-deleted]]');
		} else if (!postData.deleted && !isDelete) {
			throw new Error('[[error:post-already-restored]]');
		}

		if (!canDelete.flag) {
			throw new Error(canDelete.message);
		}
		let post;
		if (isDelete) {
			Posts.clearCachedPost(pid);
			post = await Posts.delete(pid, uid);
		} else {
			post = await Posts.restore(pid, uid);
			post = await Posts.parsePost(post);
		}
		return post;
	}

	async function togglePostPin(uid, pid, pin) {
		const postData = await Posts.getPostData(pid);
		if (!postData) {
			throw new Error('[[error:no-post]]');
		}

		const cid = postData.cid || await Posts.getPostField(pid, 'cid');
		const isAdminOrMod = await privileges.categories.isAdminOrMod(cid, uid);
		if (!isAdminOrMod) {
			throw new Error('[[error:no-privileges]]');
		}

		await Posts.setPostField(pid, 'pinned', pin ? 1 : 0);
		await events.log({ type: pin ? 'post-pin' : 'post-unpin', uid, pid, tid: postData.tid, cid });
		postData.pinned = pin;
		plugins.hooks.fire('action:post.' + (pin ? 'pin' : 'unpin'), { post: _.clone(postData), uid });
		return postData;
	}
};
