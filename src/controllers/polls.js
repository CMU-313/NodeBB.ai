'use strict';

const Polls = require('../database/polls');

module.exports = {
	createPoll: async (req, res) => {
		try {
			const { question, options } = req.body;
			const poll = await Polls.create({
				question,
				options: options.map(option => ({ text: option, votes: 0 })),
			});
			res.status(201).json(poll);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	},

	getPolls: async (req, res) => {
		try {
			const polls = await Polls.getAll();
			res.json(polls);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	},

	votePoll: async (req, res) => {
		try {
			const { pollId } = req.params;
			const { optionIndex } = req.body;
			const poll = await Polls.vote(pollId, optionIndex);
			res.json(poll);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	},
};