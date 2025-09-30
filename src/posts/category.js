
'use strict';


const _ = require('lodash');

const db = require('../database');
const topics = require('../topics');
const activitypub = require('../activitypub');

module.exports = function (Posts) {
	Posts.getCidByPid = async function (pid) {
		const tid = await Posts.getPostField(pid, 'tid');
		if (!tid && activitypub.helpers.isUri(pid)) {
			return -1; // fediverse pseudo-category
		}

		return await topics.getTopicField(tid, 'cid');
	};

	Posts.getCidsByPids = async function (pids) {
		const postData = await Posts.getPostsFields(pids, ['tid']);
		const tids = _.uniq(postData.map(post => post && post.tid).filter(Boolean));
		const topicData = await topics.getTopicsFields(tids, ['cid']);
		const tidToTopic = _.zipObject(tids, topicData);
		const cids = postData.map(post => tidToTopic[post.tid] && tidToTopic[post.tid].cid);
		return cids;
	};

	Posts.filterPidsByCid = async function (pids, cid, uid) {
		if (!cid) {
			return pids;
		}

		if (!Array.isArray(cid) || cid.length === 1) {
			const filtered = await filterPidsBySingleCid(pids, cid);

			// Extra step: filter by pinAudience if applicable
			const postData = await Posts.getPostsFields(filtered, ['tid']);
			const tids = _.uniq(postData.map(post => post && post.tid).filter(Boolean));
			const topicData = await topics.getTopicsFields(tids, ['cid', 'pinAudience']);

			// Determine user’s role
			const isStudent = await db.isMemberOfGroup(uid, 'students'); // adjust depending on your helpers
			const isInstructor = await db.isMemberOfGroup(uid, 'instructors');

			return filtered.filter((pid, idx) => {
				const t = topicData.find(t => t.cid === cid && t.tid === postData[idx].tid);
				if (!t || !t.pinAudience) return true; // default visible
				const audience = JSON.parse(t.pinAudience);
				if (audience.includes('all')) return true;
				if (isStudent && audience.includes('students')) return true;
				if (isInstructor && audience.includes('instructors')) return true;
				return false;
			});
		}

		const pidsArr = await Promise.all(cid.map(c => Posts.filterPidsByCid(pids, c, uid)));
		return _.union(...pidsArr);
	};

	async function filterPidsBySingleCid(pids, cid) {
		const isMembers = await db.isSortedSetMembers(`cid:${parseInt(cid, 10)}:pids`, pids);
		return pids.filter((pid, index) => pid && isMembers[index]);
	}
};
