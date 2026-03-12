'use strict';

const _ = require('lodash');
const validator = require('validator');

const db = require('../database');
const posts = require('../posts');
const topics = require('../topics');
const utils = require('../utils');
const plugins = require('../plugins');
const Flags = require('../flags');

module.exports = function (User) {
	User.getLatestBanInfo = async function (uid) {
		let result = null;
		const records = await db.getSortedSetRevRange(`uid:${uid}:bans:timestamp`, 0, 0);

		if (records.length) {
			const banInfo = await db.getObject(records[0]);
			const expire = parseInt(banInfo.expire, 10);
			const expireReadable = utils.toISOString(expire);

			result = {
				uid,
				timestamp: banInfo.timestamp,
				banned_until: expire,
				expiry: expire, // backward compatible alias
				banned_until_readable: expireReadable,
				expiry_readable: expireReadable, // backward compatible alias
				reason: validator.escape(String(banInfo.reason || '')),
			};
		} else {
			throw new Error('no-ban-info');
		}

		return result;
	};

	User.getModerationHistory = async function (uid) {
		const [flagsRaw, bansRaw, mutesRaw] = await Promise.all([
			db.getSortedSetRevRangeWithScores(`flags:byTargetUid:${uid}`, 0, 19),
			db.getSortedSetRevRange([`uid:${uid}:bans:timestamp`, `uid:${uid}:unbans:timestamp`], 0, 19),
			db.getSortedSetRevRange([`uid:${uid}:mutes:timestamp`, `uid:${uid}:unmutes:timestamp`], 0, 19),
		]);

		const keys = flagsRaw.map(f => `flag:${f.value}`);
		const payload = await db.getObjectsFields(keys, ['flagId', 'type', 'targetId', 'datetime']);

		const [flags, bans, mutes] = await Promise.all([
			getFlagMetadata(payload),
			formatBanMuteData(bansRaw, '[[user:info.banned-no-reason]]'),
			formatBanMuteData(mutesRaw, '[[user:info.muted-no-reason]]'),
		]);

		return { flags, bans, mutes };
	};

	User.getHistory = async function (set) {
		const data = await db.getSortedSetRevRangeWithScores(set, 0, -1);
		const uids = new Set();

		data.forEach(item => {
			item.timestamp = item.score;
			item.timestampISO = utils.toISOString(item.score);
			const parts = item.value.split(':');
			item.value = validator.escape(String(parts[0]));
			item.byUid = validator.escape(String(parts[2] || ''));
			delete item.score;
			if (item.byUid) uids.add(item.byUid);
		});

		const usersData = await User.getUsersFields([...uids], ['uid', 'username', 'userslug', 'picture']);
		const uidToUser = _.zipObject([...uids], usersData);

		data.forEach(d => { if (d.byUid) d.byUser = uidToUser[d.byUid]; });

		return data;
	};

	async function getFlagMetadata(flags) {
		const postFlags = flags.filter(f => f && f.type === 'post');
		const reports = await Promise.all(flags.map(f => Flags.getReports(f.flagId)));

		flags.forEach((flag, idx) => {
			if (flag) {
				flag.timestamp = parseInt(flag.datetime, 10);
				flag.timestampISO = utils.toISOString(flag.datetime);
				flag.reports = reports[idx];
			}
		});

		const pids = postFlags.map(f => parseInt(f.targetId, 10));
		const postData = await posts.getPostsFields(pids, ['tid']);
		const tids = postData.map(p => p.tid);
		const topicData = await topics.getTopicsFields(tids, ['title']);

		postFlags.forEach((flagObj, idx) => {
			flagObj.pid = flagObj.targetId;
			if (!tids[idx]) flagObj.targetPurged = true;
			_.extend(flagObj, topicData[idx]);
		});

		return flags;
	}

	async function formatBanMuteData(keys, noReasonLangKey) {
		const data = await db.getObjects(keys);
		const uids = data.map(d => d.fromUid);
		const usersData = await User.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture']);

		return data.map((banObj, index) => {
			banObj.user = usersData[index];
			banObj.until = parseInt(banObj.expire, 10);
			banObj.untilISO = utils.toISOString(banObj.until);
			banObj.timestampISO = utils.toISOString(banObj.timestamp);
			banObj.reason = validator.escape(String(banObj.reason || '')) || noReasonLangKey;
			return banObj;
		});
	}

	User.getModerationNotes = async function (uid, start, stop) {
		const noteIds = await db.getSortedSetRevRange(`uid:${uid}:moderation:notes`, start, stop);
		return await User.getModerationNotesByIds(uid, noteIds);
	};

	User.getModerationNotesByIds = async (uid, noteIds) => {
		const keys = noteIds.map(id => `uid:${uid}:moderation:note:${id}`);
		const notes = await db.getObjects(keys);
		const uids = [];

		notes.forEach((note, idx) => {
			if (note) {
				note.id = noteIds[idx];
				uids.push(note.uid);
				note.timestampISO = utils.toISOString(note.timestamp);
			}
		});

		const userData = await User.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture']);

		await Promise.all(notes.map(async (note, index) => {
			if (note) {
				note.rawNote = validator.escape(String(note.note));
				note.note = await plugins.hooks.fire('filter:parse.raw', String(note.note));
				note.user = userData[index];
			}
		}));

		return notes;
	};

	User.appendModerationNote = async ({ uid, noteData }) => {
		await db.sortedSetAdd(`uid:${uid}:moderation:notes`, noteData.timestamp, noteData.timestamp);
		await db.setObject(`uid:${uid}:moderation:note:${noteData.timestamp}`, noteData);
	};

	User.setModerationNote = async ({ uid, noteData }) => {
		await db.setObject(`uid:${uid}:moderation:note:${noteData.timestamp}`, noteData);
	};
};
