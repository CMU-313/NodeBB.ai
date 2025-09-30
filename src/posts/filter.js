'use strict';

const user = require('../user');

module.exports = function (Posts) {
	Posts.filterByStaff = async function (posts, showStaffOnly) {
		if (!Array.isArray(posts) || !posts.length || !showStaffOnly) {
			return posts;
		}

		const uids = posts.map(post => post.uid);
		const isStaffMap = new Map();
		
		// Get staff status for all unique uids
		await Promise.all([...new Set(uids)].map(async (uid) => {
			const isStaff = await user.isStaff(uid);
			isStaffMap.set(uid, isStaff);
		}));

		// Filter posts if showStaffOnly is true
		if (showStaffOnly) {
			posts = posts.filter(post => isStaffMap.get(post.uid));
		}

		// Add isStaff flag to all posts for UI display
		posts.forEach((post) => {
			post.isStaff = isStaffMap.get(post.uid);
		});

		return posts;
	};
};