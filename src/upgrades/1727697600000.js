'use strict';

const groups = require('../groups');

module.exports = {
	name: 'Create instructors group',
	timestamp: Date.UTC(2025, 8, 30, 12, 0, 0),
	method: async () => {
		// Check if instructors group already exists
		const exists = await groups.exists('instructors');
		if (!exists) {
			await groups.create({
				name: 'instructors',
				description: 'Instructors who can endorse student posts',
				hidden: 0,
				system: 1,
				private: 0,
				disableJoinRequests: 0,
				disableLeave: 0,
				userTitle: 'Instructor',
			});
			console.log('[2025/09/30] Instructors group created successfully');
		} else {
			console.log('[2025/09/30] Instructors group already exists');
		}
	},
};