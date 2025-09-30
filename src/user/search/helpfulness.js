'use strict';

const user = require('../user');
const db = require('../database');

module.exports = function (Users) {
	const originalSearch = Users.search;
	
	Users.search = async function (data) {
		const results = await originalSearch(data);

		// If sorting by helpfulness is requested
		if (data.sortBy === 'helpfulness') {
			const uids = await user.getMostHelpfulUsers(data.page - 1, data.resultsPerPage);
			results.users = await user.getUsers(uids);
			results.matchCount = await db.sortedSetCard('users:helpfulness');
		}

		return results;
	};
};