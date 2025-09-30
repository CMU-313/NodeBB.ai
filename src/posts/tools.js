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

	Posts.tools.endorse = async function (uid, pid) {
		// Check if the user has permission to endorse
		const isAdminOrInstructor = await privileges.posts.canEdit(pid, uid);
		if (!isAdminOrInstructor.flag) {
			throw new Error('[[error:no-privileges]]');
		}

		// Get the current post data
		const postData = await Posts.getPostData(pid);
		if (!postData) {
			throw new Error('[[error:no-post]]');
		}

		// Toggle the endorsement status
		const isEndorsed = postData.isEndorsed ? 0 : 1;
		await Posts.setPostField(pid, 'isEndorsed', isEndorsed);

		// Return the updated post data
		return {
			pid,
			isEndorsed,
		};
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
};
