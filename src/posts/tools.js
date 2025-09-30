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

	Posts.tools.createAnonymousPost = async function (data) {
		const { content, tid } = data; // Removed unused 'uid'

		// Validate content and topic ID
		if (!content || !tid) {
			throw new Error('[[error:invalid-post-data]]');
		}

		// Create the post with an anonymous flag
		const post = {
			uid: null, // No user ID associated
			content,
			tid,
			anonymous: true,
			timestamp: Date.now(),
		};

		// Save the post (assuming Posts.save is a method to save posts)
		const savedPost = await Posts.save(post);

		// Return the saved post
		return savedPost;
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
