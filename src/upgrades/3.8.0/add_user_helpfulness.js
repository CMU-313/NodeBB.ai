'use strict';

const batch = require('../../batch');
const db = require('../../database');
const posts = require('../../posts');

// Add helpfulness score tracking
module.exports = {
	name: 'Add user helpfulness score tracking',
	timestamp: Date.UTC(2025, 8, 30),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet('posts:pid', async (pids) => {
			progress.incr(pids.length);

			// Get post data including votes and if it's an accepted answer
			const postsData = await posts.getPostsFields(pids, ['pid', 'uid', 'votes', 'isAnswer']);
			
			// Group posts by user
			const userPosts = {};
			postsData.forEach((post) => {
				if (!post.uid) return;
				
				if (!userPosts[post.uid]) {
					userPosts[post.uid] = {
						totalVotes: 0,
						acceptedAnswers: 0,
						helpfulPosts: 0,
					};
				}

				// Count votes
				const votes = parseInt(post.votes, 10) || 0;
				if (votes > 0) {
					userPosts[post.uid].totalVotes += votes;
					userPosts[post.uid].helpfulPosts += 1;
				}

				// Count accepted answers
				if (post.isAnswer) {
					userPosts[post.uid].acceptedAnswers += 1;
				}
			});

			// Calculate and store helpfulness scores
			await Promise.all(Object.entries(userPosts).map(async ([uid, data]) => {
				// Calculate helpfulness score: 
				// (accepted answers * 10) + (total upvotes) + (helpful posts * 2)
				const helpfulnessScore = 
					(data.acceptedAnswers * 10) + 
					data.totalVotes + 
					(data.helpfulPosts * 2);

				await db.sortedSetAdd('users:helpfulness', helpfulnessScore, uid);
			}));
		}, {
			batch: 500,
		});
	},
};