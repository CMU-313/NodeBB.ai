'use strict';

const db = require('../../database');

module.exports = {
	name: 'Add anonymous field to posts',
	timestamp: Date.UTC(2025, 8, 30),
	method: async function () {
		const { progress } = this;
		
		// Get all post keys to initialize anonymous field
		const postKeys = await db.getSortedSetRange('posts:pid', 0, -1);
		const keys = postKeys.map(pid => `post:${pid}`);
		
		progress.total = keys.length;
		
		if (keys.length > 0) {
			const batch = require('../../batch');
			await batch.processSortedSet('posts:pid', async (pids) => {
				// Check which posts don't have the anonymous field and set it to 0
				const postData = await db.getObjectsFields(pids.map(pid => `post:${pid}`), ['anonymous']);
				const updates = [];
				
				postData.forEach((post, index) => {
					if (!post.hasOwnProperty('anonymous')) {
						updates.push([`post:${pids[index]}`, { anonymous: 0 }]);
					}
					progress.incr();
				});
				
				if (updates.length > 0) {
					await db.setObjectBulk(updates);
				}
			}, {
				batch: 500,
				progress: progress,
			});
		}
	},
};