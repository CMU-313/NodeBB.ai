'use strict';

const db = require('../database');
const user = require('../user');

module.exports = function (Categories) {
	/**
	 * Get contribution leaderboard for a category
	 * @param {number} cid - Category ID
	 * @param {number} start - Starting index for pagination
	 * @param {number} stop - Ending index for pagination
	 * @returns {Promise<Array>} - Array of user contribution data
	 */
	Categories.getLeaderboard = async function (cid, start, stop) {
		// Get all unique user IDs who have posted or created topics in this category
		const [topicCreators, postAuthors] = await Promise.all([
			db.getSortedSetRevRange(`cid:${cid}:uid`, 0, -1),
			db.getSortedSetRevRange(`cid:${cid}:pids`, 0, -1),
		]);

		// Get unique UIDs from posts
		const pids = postAuthors;
		const postUids = pids.length ? await db.getObjectsFields(
			pids.map(pid => `post:${pid}`),
			['uid']
		).then(posts => posts.map(p => p.uid)) : [];

		// Combine and deduplicate UIDs
		const allUids = [...new Set([...topicCreators, ...postUids])].filter(uid => uid && parseInt(uid, 10) > 0);

		// Get post and topic counts for each user in this category
		const userData = await Promise.all(allUids.map(async (uid) => {
			const [postCount, topicCount, userFields] = await Promise.all([
				db.sortedSetCard(`cid:${cid}:uid:${uid}:pids`),
				db.sortedSetCard(`cid:${cid}:uid:${uid}:tids`),
				user.getUserFields(uid, ['uid', 'username', 'userslug', 'picture']),
			]);

			return {
				uid: uid,
				username: userFields.username,
				userslug: userFields.userslug,
				picture: userFields.picture,
				postCount: postCount || 0,
				topicCount: topicCount || 0,
				totalCount: (postCount || 0) + (topicCount || 0),
			};
		}));

		// Sort by total contributions (posts + topics)
		userData.sort((a, b) => b.totalCount - a.totalCount);

		// Add rank
		userData.forEach((user, index) => {
			user.rank = index + 1;
		});

		// Apply pagination
		const paginatedData = start !== undefined && stop !== undefined ?
			userData.slice(start, stop + 1) : userData;

		return paginatedData;
	};

	/**
	 * Get leaderboard for all categories combined
	 * @param {number} start - Starting index for pagination
	 * @param {number} stop - Ending index for pagination
	 * @returns {Promise<Array>} - Array of user contribution data
	 */
	Categories.getGlobalLeaderboard = async function (start, stop) {
		// Get all users sorted by post count
		const uids = await db.getSortedSetRevRange('users:postcount', 0, -1);
		
		const userData = await Promise.all(uids.filter(uid => parseInt(uid, 10) > 0).map(async (uid) => {
			const [userFields, topicCount] = await Promise.all([
				user.getUserFields(uid, ['uid', 'username', 'userslug', 'picture', 'postcount']),
				db.sortedSetCard(`uid:${uid}:topics`),
			]);

			return {
				uid: uid,
				username: userFields.username,
				userslug: userFields.userslug,
				picture: userFields.picture,
				postCount: userFields.postcount || 0,
				topicCount: topicCount || 0,
				totalCount: (userFields.postcount || 0) + (topicCount || 0),
			};
		}));

		// Sort by total contributions
		userData.sort((a, b) => b.totalCount - a.totalCount);

		// Add rank
		userData.forEach((user, index) => {
			user.rank = index + 1;
		});

		// Apply pagination
		const paginatedData = start !== undefined && stop !== undefined ?
			userData.slice(start, stop + 1) : userData;

		return paginatedData;
	};
};
