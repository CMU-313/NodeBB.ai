const assert = require('assert');
const db = require('../src/database');
const Polls = require('../src/polls');

describe('Polls.createPoll', function () {
	beforeEach(async function () {
		// Optionally clear test data if needed
	});

	it('should create a poll with valid data', async function () {
		const data = {
			question: 'Favorite color?',
			options: ['Red', 'Blue', 'Green'],
			creator: 1,
		};
		const poll = await Polls.createPoll(data);
		assert.ok(poll.pid);
		assert.strictEqual(poll.question, data.question);
		assert.deepStrictEqual(poll.options, data.options);
		assert.strictEqual(poll.creator, data.creator);
		assert.ok(poll.timestamp);
	});

	it('should throw error for missing question', async function () {
		const data = { options: ['A', 'B'], creator: 1 };
		await assert.rejects(() => Polls.createPoll(data), /invalid-poll-data/);
	});

	it('should throw error for less than 2 options', async function () {
		const data = { question: 'Q?', options: ['A'], creator: 1 };
		await assert.rejects(() => Polls.createPoll(data), /invalid-poll-data/);
	});
});
