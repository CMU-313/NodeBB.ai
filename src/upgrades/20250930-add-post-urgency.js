'use strict';

const db = require('../database');

module.exports = async function (done) {
	// Set urgency=0 for posts that don't have the field yet
	try {
		const ids = await db.getSortedSetRange('posts:pid', 0, -1);
		if (!ids || !ids.length) {
			return done();
		}

		const keys = ids.map(pid => `post:${pid}`);
		const posts = await db.getObjects(keys, ['urgency']);
		const bulk = [];
		posts.forEach((p, idx) => {
			if (p && (p.urgency === null || p.urgency === undefined)) {
				bulk.push([`post:${ids[idx]}`, { urgency: 0 }]);
			}
		});
		if (bulk.length) {
			await db.setObjectBulk(bulk);
		}
		done();
	} catch (err) {
		done(err);
	}
};
