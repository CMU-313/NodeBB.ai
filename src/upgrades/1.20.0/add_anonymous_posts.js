'use strict';

const db = require('../../database');

module.exports = {
	name: 'Add anonymous field to posts',
	timestamp: Date.now(),
	method: async function () {
		const { progress } = this;

		// Add anonymous field to posts object fields
		const posts = await db.getObjectFields('post:*', ['pid']);
		const postIds = posts.map(p => p.pid).filter(Boolean);
		
		if (postIds.length > 0) {
			progress.total = postIds.length;
			progress.incr = Math.max(1, Math.floor(postIds.length / 100));

			const batch = require('../../batch');
			await batch.processSortedSet('posts:pid', async (pids) => {
				const keys = pids.map(pid => `post:${pid}`);
				const posts = await db.getObjects(keys);
				
				const operations = [];
				posts.forEach((post, index) => {
					if (post && post.pid && typeof post.anonymous === 'undefined') {
						operations.push(['setObjectField', `post:${post.pid}`, 'anonymous', 0]);
					}
				});
				
				if (operations.length > 0) {
					await db.batch(operations);
				}
				
				if (progress.incr) {
					progress.incr(pids.length);
				}
			}, {
				batch: 500,
			});
		}
	},
};