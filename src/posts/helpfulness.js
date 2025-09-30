'use strict';

const db = require('../database');
const user = require('../user');

module.exports = function (Posts) {
	const originalSetPostField = Posts.setPostField;
	Posts.setPostField = async function (pid, field, value) {
		await originalSetPostField(pid, field, value);
		
		// Update helpfulness score when a post is marked as an answer or voted
		if (field === 'isAnswer' || field === 'votes') {
			const post = await Posts.getPostFields(pid, ['uid']);
			if (post.uid) {
				await user.updateHelpfulnessScore(post.uid);
			}
		}
	};

	Posts.updateVotes = async function (post) {
		if (!post || !post.uid || !post.pid) {
			return;
		}
		const votes = post.upvotes - post.downvotes;
		
		// Update post votes tracking
		await Promise.all([
			db.sortedSetAdd(`uid:${post.uid}:posts:votes`, votes, post.pid),
			db.incrObjectField(`uid:${post.uid}:posts:votes:total`, 'votes', votes > 0 ? votes : 0),
		]);

		// Update user helpfulness score
		await user.updateHelpfulnessScore(post.uid);
	};

	// Hook into answer acceptance
	Posts.markAsAnswer = async function (pid) {
		const post = await Posts.getPostFields(pid, ['uid']);
		await Posts.setPostField(pid, 'isAnswer', 1);
		await db.sortedSetAdd(`uid:${post.uid}:posts:accepted`, Date.now(), pid);
		// Other answer-related logic would go here
	};
};