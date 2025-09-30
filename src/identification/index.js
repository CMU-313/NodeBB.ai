'use strict';

const db = require('../database');

const Identification = module.exports;

// Store ranks as sorted set of slugs and objects at identification:rank:<slug>
Identification.getRanks = async function () {
	const keys = await db.getSortedSetRange('identification:ranks', 0, -1);
	const objs = await db.getObjects(keys.map(k => `identification:rank:${k}`));
	return objs.filter(Boolean);
};

Identification.getRank = async function (slug) {
	return await db.getObject(`identification:rank:${slug}`);
};

Identification.saveRank = async function (rank) {
	// rank should include slug
	if (!rank || !rank.slug) {
		throw new Error('Invalid rank');
	}
	await db.setObject(`identification:rank:${rank.slug}`, rank);
	// ensure present in set
	await db.sortedSetAdd('identification:ranks', [rank.slug], [rank.slug]);
	return rank;
};

Identification.deleteRank = async function (slug) {
	await db.delete(`identification:rank:${slug}`);
	await db.sortedSetRemove('identification:ranks', [slug]);
};
