'use strict';

const identification = require('../../identification');

const IdentificationAdmin = module.exports;

IdentificationAdmin.getRanks = async function () {
	return await identification.getRanks();
};

IdentificationAdmin.saveRank = async function (socket, rank) {
	if (!rank) {
		throw new Error('[[error:invalid-data]]');
	}
	await identification.saveRank(rank);
	return rank;
};

IdentificationAdmin.deleteRank = async function (socket, slug) {
	if (!slug) {
		throw new Error('[[error:invalid-data]]');
	}
	await identification.deleteRank(slug);
};

require('../../promisify')(IdentificationAdmin);
