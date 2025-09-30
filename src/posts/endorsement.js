'use strict';

const db = require('../database');
const user = require('../user');
const privileges = require('../privileges');
const plugins = require('../plugins');

module.exports = function (Posts) {
	Posts.endorse = async function (pid, uid) {
		if (!(await privileges.posts.canEndorse(pid, uid))) {
			throw new Error('[[error:no-privileges]]');
		}

		const postData = await Posts.getPostFields(pid, ['endorsed', 'endorsedBy', 'tid']);
		if (parseInt(postData.endorsed, 10) === 1) {
			throw new Error('[[error:post-already-endorsed]]');
		}

		const now = Date.now();
		await Posts.setPostFields(pid, {
			endorsed: 1,
			endorsedBy: uid,
			endorsedTimestamp: now,
		});

		await db.sortedSetAdd(`uid:${uid}:endorsed`, now, pid);

		plugins.hooks.fire('action:post.endorse', {
			pid: pid,
			uid: uid,
			tid: postData.tid,
		});
		
		return {
			endorsed: true,
			endorsedBy: uid,
			endorsedTimestamp: now,
		};
	};

	Posts.unendorse = async function (pid, uid) {
		if (!(await privileges.posts.canEndorse(pid, uid))) {
			throw new Error('[[error:no-privileges]]');
		}

		const postData = await Posts.getPostFields(pid, ['endorsed', 'endorsedBy', 'tid']);
		if (parseInt(postData.endorsed, 10) !== 1) {
			throw new Error('[[error:post-not-endorsed]]');
		}

		await Posts.setPostFields(pid, {
			endorsed: 0,
			endorsedBy: 0,
			endorsedTimestamp: 0,
		});

		await db.sortedSetRemove(`uid:${uid}:endorsed`, pid);

		plugins.hooks.fire('action:post.unendorse', {
			pid: pid,
			uid: uid,
			tid: postData.tid,
		});

		return {
			endorsed: false,
		};
	};

	Posts.getEndorsementData = async function (pids) {
		if (!Array.isArray(pids) || !pids.length) {
			return [];
		}

		const postFields = ['endorsed', 'endorsedBy', 'endorsedTimestamp'];
		const postsData = await Posts.getPostsFields(pids, postFields);
		
		const endorsedByUids = postsData
			.filter(post => parseInt(post.endorsed, 10) === 1 && post.endorsedBy)
			.map(post => post.endorsedBy);

		const endorsersData = endorsedByUids.length ? await user.getUsersFields(endorsedByUids, ['uid', 'username', 'userslug', 'picture']) : [];
		const endorsersMap = {};
		endorsersData.forEach((endorser) => {
			endorsersMap[endorser.uid] = endorser;
		});

		return postsData.map((post) => {
			if (parseInt(post.endorsed, 10) === 1 && post.endorsedBy) {
				return {
					endorsed: true,
					endorsedBy: endorsersMap[post.endorsedBy] || null,
					endorsedTimestamp: parseInt(post.endorsedTimestamp, 10),
				};
			}
			return {
				endorsed: false,
			};
		});
	};

	Posts.isEndorsed = async function (pid) {
		const endorsed = await Posts.getPostField(pid, 'endorsed');
		return parseInt(endorsed, 10) === 1;
	};
};