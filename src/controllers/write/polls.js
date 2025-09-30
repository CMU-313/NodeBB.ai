 'use strict';

const api = require('../../api');
const helpers = require('../helpers');

const Polls = module.exports;

Polls.create = async (req, res) => {
	// minimal: accept body with title, options
	const { title, options, pid } = req.body || {};
	const data = { title, options, pid, uid: req.uid };
	const pollId = await api.polls.create(req, data);
	helpers.formatApiResponse(200, res, { pollId });
};

Polls.get = async (req, res) => {
	const { pollId } = req.params;
	const data = await api.polls.get(pollId, req.uid);
	if (!data) return helpers.formatApiResponse(404, res, new Error('[[error:no-poll]]'));
	helpers.formatApiResponse(200, res, data);
};

Polls.vote = async (req, res) => {
	const { pollId } = req.params;
	const { optionId } = req.body || {};
	await api.polls.vote(pollId, req.uid, optionId);
	helpers.formatApiResponse(200, res);
};

Polls.unvote = async (req, res) => {
	const { pollId } = req.params;
	await api.polls.unvote(pollId, req.uid);
	helpers.formatApiResponse(200, res);
};
