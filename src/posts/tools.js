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

	Posts.tools.archive = async function (uid, pid) {
		return await togglePostArchive(uid, pid, true);
	};

	Posts.tools.unarchive = async function (uid, pid) {
		return await togglePostArchive(uid, pid, false);
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


	async function togglePostArchive(uid, pid, isArchive) {
		const [postData, canArchive] = await Promise.all([
			Posts.getPostData(pid),
			privileges.posts.can('posts:delete', pid, uid),
			// using posts:delete privilege as a proxy for archive permissions
		]);
		if (!postData) {
			throw new Error('[[error:no-post]]');
		}

		if (postData.archived && isArchive) {
			throw new Error('[[error:post-already-archived]]');
		} else if (!postData.archived && !isArchive) {
			throw new Error('[[error:post-already-unarchived]]');
		}

		if (!canArchive) {
			throw new Error('[[error:no-privileges]]');
		}

		let post;
		if (isArchive) {
			// Clear cache so UI updates
			Posts.clearCachedPost(pid);
			await Posts.setPostFields(pid, { archived: 1 });
			post = await Posts.getPostData(pid);
		} else {
			await Posts.setPostFields(pid, { archived: 0 });
			post = await Posts.getPostData(pid);
			post = await Posts.parsePost(post);
		}
		return post;
	}
};
