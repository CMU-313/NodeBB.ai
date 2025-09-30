'use strict';

const db = require('./index');

const Polls = {
	async create(poll) {
		const pollId = await db.incrObjectField('global', 'nextPollId');
		poll.id = pollId;
		await db.setObject(`poll:${pollId}`, poll);
		await db.listAppend('polls', pollId);
		return poll;
	},

	async getAll() {
		const pollIds = await db.getList('polls');
		const polls = await Promise.all(pollIds.map(id => db.getObject(`poll:${id}`)));
		return polls;
	},

	async vote(pollId, optionIndex) {
		const pollKey = `poll:${pollId}`;
		const poll = await db.getObject(pollKey);
		if (!poll) {
			throw new Error('Poll not found');
		}
		poll.options[optionIndex].votes += 1;
		await db.setObject(pollKey, poll);
		return poll;
	},
};

module.exports = Polls;
