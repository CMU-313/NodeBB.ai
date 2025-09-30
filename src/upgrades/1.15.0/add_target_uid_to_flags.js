'use strict';

const db = require('../../database');
const batch = require('../../batch');
const posts = require('../../posts');

module.exports = {
	name: 'Add target uid to flag objects',
	timestamp: Date.UTC(2020, 7, 22),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet(
			'flags:datetime'
			async (flagIds) => {
				progress.incr(flagIds.length);
				const flagData = await db.getObjects(
					flagIds.map(id => `flag:${id}`)
				);

				// Collect async operations
				const ops = flagData
					.filter(flagObj => flagObj && flagObj.targetId)
					.map(async (flagObj) => {
						const { targetId, type, flagId } = flagObj;

						if (type === 'post') {
							const targetUid = await posts.getPostField(targetId, 'uid');
							if (!targetUid) return;
							return db.setObjectField(`flag:${flagId}`, 'targetUid', targetUid);
						}

						if (type === 'user') {
							return db.setObjectField(`flag:${flagId}`, 'targetUid', targetId);
						}
					});

				// Run all in parallel
				await Promise.all(ops);
			},
			{
				progress,
				batch: 500,
			}
		);
	},
};