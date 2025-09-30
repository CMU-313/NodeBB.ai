'use strict';

const db = require('../../database');

module.exports = {
	name: 'Add pinAudience field to topics',
	timestamp: Date.UTC(2025, 9, 29),
	method: async function () {
		const { progress } = this;

		// Get all topic IDs
		const tids = await db.getSortedSetRange('topics:tid', 0, -1);
		progress.total = tids.length;

		for (const tid of tids) {
			// Default pinAudience = 'all' for backwards compatibility
			await db.setObjectField(`topic:${tid}`, 'pinAudience', 'all');
			progress.incr();
		}
	},
};