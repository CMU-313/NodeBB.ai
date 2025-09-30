"use strict";

const db = require("../database");
const plugins = require("../plugins");

const Polls = module.exports;

// Create a poll
Polls.createPoll = async (data) => {
	if (!data || !data.question || !Array.isArray(data.options) || data.options.length < 2) {
		throw new Error("[[error:invalid-poll-data]]");
	}

	const pid = await db.incrObjectField("global", "nextPid");
	const timestamp = data.timestamp || Date.now();
	const poll = {
		pid,
		question: String(data.question),
		options: data.options.map(String),
		creator: data.creator,
		timestamp,
	};

	const savedPoll = await plugins.hooks.fire("filter:polls.save", poll);
	await db.setObject(`poll:${pid}`, savedPoll);
	await db.sortedSetAdd("polls:pid", timestamp, pid);
	await db.incrObjectField("global", "pollCount");

	plugins.hooks.fire("action:polls.save", { poll: savedPoll, data });
	return savedPoll;
};
