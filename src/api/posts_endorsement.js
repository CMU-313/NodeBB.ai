'use strict';

const posts = require('../posts');

const apiPosts = module.exports;

apiPosts.endorse = async (caller, data) => {
	return await posts.endorse(data.pid, caller.uid);
};

apiPosts.unendorse = async (caller, data) => {
	return await posts.unendorse(data.pid, caller.uid);
};

apiPosts.getEndorsement = async (caller, data) => {
	const endorsementData = await posts.getEndorsementData([data.pid]);
	return endorsementData[0] || { endorsed: false };
};