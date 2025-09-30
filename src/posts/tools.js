'use strict';

const privileges = require('../privileges');
const db = require('../database');
const plugins = require('../plugins');
const events = require('../events');

module.exports = function (Posts) {
	Posts.tools = {};

	Posts.tools.delete = async function (uid, pid) {
		return await togglePostDelete(uid, pid, true);
	};

	Posts.tools.restore = async function (uid, pid) {
		return await togglePostDelete(uid, pid, false);
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

	Posts.tools.pin = async function (uid, pid) {
		const postData = await Posts.getPostData(pid);
		if (!postData) {
			throw new Error('[[error:no-post]]');
		}
		const cid = await Posts.getCidByPid(pid);
		if (!await privileges.categories.isAdminOrMod(cid, uid)) {
			throw new Error('[[error:no-privileges]]');
		}
		const { tid } = postData;
		const promises = [
			Posts.setPostFields(pid, { pinned: 1 }),
			db.sortedSetAdd(`tid:${tid}:pids:pinned`, Date.now(), pid),
			events.log({ type: 'post-pin', uid: uid, pid: pid, tid: tid }),
			plugins.hooks.fire('action:post.pin', { pid: pid, tid: tid, uid: uid }),
		];
		await Promise.all(promises);
		return await Posts.getPostData(pid);
	};

	Posts.tools.unpin = async function (uid, pid) {
		const postData = await Posts.getPostData(pid);
		if (!postData) {
			throw new Error('[[error:no-post]]');
		}
		const cid = await Posts.getCidByPid(pid);
		if (!await privileges.categories.isAdminOrMod(cid, uid)) {
			throw new Error('[[error:no-privileges]]');
		}
		const { tid } = postData;
		const promises = [
			Posts.setPostFields(pid, { pinned: 0 }),
			db.sortedSetRemove(`tid:${tid}:pids:pinned`, pid),
			events.log({ type: 'post-unpin', uid: uid, pid: pid, tid: tid }),
			plugins.hooks.fire('action:post.unpin', { pid: pid, tid: tid, uid: uid }),
		];
		await Promise.all(promises);
		return await Posts.getPostData(pid);
	};
};
