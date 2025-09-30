'use strict';

const db = require('../database');
const plugins = require('../plugins');
const groups = require('../groups');

module.exports = function (Polls) {
	// Create a poll object. Minimal implementation.
	Polls.create = async function (data) {
		// data: { pid, title, options: [{id, text}], multiChoice }
		const pollId = data.pollId || Date.now();
		const key = `poll:${pollId}`;
		await db.setObject(key, {
			pollId,
			pid: data.pid || 0,
			title: data.title || '',
			options: JSON.stringify(data.options || []),
			multiChoice: data.multiChoice ? 1 : 0,
			uid: data.uid || 0,
			createdAt: Date.now(),
		});
		return pollId;
	};

	Polls.get = async function (pollId, uid) {
		const key = `poll:${pollId}`;
		const pollObj = await db.getObject(key);
		if (!pollObj || !pollObj.options) {
			return null;
		}
		const options = JSON.parse(pollObj.options || '[]');

		// get counts for each option
		const counts = await db.getSetsMembers(options.map(opt => `poll:${pollId}:option:${opt.id}:votes`));
		const optionCounts = counts.map(c => Array.isArray(c) ? c.length : 0);

		// determine user's vote
		let userChoice = null;
		if (uid && parseInt(uid, 10) > 0) {
			const value = await db.getObjectField(`poll:${pollId}:voters`, String(uid));
			if (value) userChoice = value;
		}

		return {
			pollId,
			title: pollObj.title,
			options: options.map((o, i) => ({ id: o.id, text: o.text, votes: optionCounts[i] || 0 })),
			multiChoice: !!parseInt(pollObj.multiChoice, 10),
			userChoice,
			pid: pollObj.pid,
		};
	};

	Polls.vote = async function (pollId, uid, optionId) {
		if (!uid || parseInt(uid, 10) <= 0) {
			throw new Error('[[error:not-logged-in]]');
		}

		// enforce student-only voting (assumption: group named 'students')
		const isStudent = await groups.isMember(uid, 'students');
		if (!isStudent) {
			throw new Error('[[error:no-privileges]]');
		}

		const pollKey = `poll:${pollId}`;
		const pollObj = await db.getObject(pollKey);
		if (!pollObj) {
			throw new Error('[[error:no-poll]]');
		}
		const options = JSON.parse(pollObj.options || '[]');
		const opt = options.find(o => String(o.id) === String(optionId));
		if (!opt) {
			throw new Error('[[error:no-option]]');
		}

		// remove previous vote if exists
		const prev = await db.getObjectField(`poll:${pollId}:voters`, String(uid));
		if (prev && prev !== String(optionId)) {
			await db.setRemove(`poll:${pollId}:option:${prev}:votes`, uid);
		}

		// add to new option set
		await db.setAdd(`poll:${pollId}:option:${optionId}:votes`, uid);
		// map user to option
		await db.setObjectField(`poll:${pollId}:voters`, String(uid), String(optionId));

		plugins.hooks.fire('action:poll.vote', { pollId, uid, optionId });

		return true;
	};

	Polls.unvote = async function (pollId, uid) {
		if (!uid || parseInt(uid, 10) <= 0) {
			throw new Error('[[error:not-logged-in]]');
		}
		const prev = await db.getObjectField(`poll:${pollId}:voters`, String(uid));
		if (!prev) return false;
		await db.setRemove(`poll:${pollId}:option:${prev}:votes`, uid);
		await db.setObjectField(`poll:${pollId}:voters`, String(uid), null);
		plugins.hooks.fire('action:poll.unvote', { pollId, uid });
		return true;
	};
};
