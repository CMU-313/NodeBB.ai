'use strict';

const privileges = require('../privileges');

module.exports = function (Posts) {
	Posts.tools = {};

	Posts.tools.delete = async function (uid, pid) {
		return await togglePostDelete(uid, pid, true);
	};

	Posts.tools.restore = async function (uid, pid) {
		return await togglePostDelete(uid, pid, false);
	};

	Posts.tools.hide = async function (uid, pid) {
		return await togglePostHidden(uid, pid, true);
	};

	Posts.tools.unhide = async function (uid, pid) {
		return await togglePostHidden(uid, pid, false);
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

	async function togglePostHidden(uid, pid, isHide) {
		const [postData, canHide] = await Promise.all([
			Posts.getPostData(pid),
			privileges.posts.canHide(pid, uid),
		]);
		if (!postData) {
			throw new Error('[[error:no-post]]');
		}

		if (postData.hidden && isHide) {
			throw new Error('[[error:post-already-hidden]]');
		} else if (!postData.hidden && !isHide) {
			throw new Error('[[error:post-not-hidden]]');
		}

		if (!canHide.flag) {
			throw new Error(canHide.message || '[[error:no-privileges]]');
		}

		let post;
		if (isHide) {
			Posts.clearCachedPost(pid);
			post = await Posts.hide(pid, uid);
		} else {
			post = await Posts.unhide(pid, uid);
			post = await Posts.parsePost(post);
		}
		return post;
	}
};
