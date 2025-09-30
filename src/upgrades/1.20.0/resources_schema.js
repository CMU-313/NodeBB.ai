'use strict';

const winston = require('winston');
const db = require('../../database');

module.exports = {
	name: 'Add resources table schema',
	timestamp: Date.UTC(2025, 8, 30),
	method: async function () {
		const progress = this.progress;

		progress.push('Creating resources schema...');

		try {
			// Create the global counter for resource IDs
			const exists = await db.exists('global');
			if (exists) {
				await db.setObjectField('global', 'nextResourceId', 1);
			}

			// Create sorted set for tracking resources by creation time
			await db.createSortedSet('resources:createtime', []);

			winston.info('[2025/09/30] Resources schema created');
			progress.push('Resources schema created');
		} catch (err) {
			winston.error(`Error creating resources schema: ${err.message}`);
			throw err;
		}
	},
};