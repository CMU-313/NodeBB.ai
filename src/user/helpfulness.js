'use strict';

const db = require('../database');
const plugins = require('../plugins');

module.exports = function (User) {
	User.incrementHelpfulness = async function (uid, amount) {
		if (parseInt(uid, 10) <= 0) {
			return;
		}
		const currentScore = await User.getHelpfulnessScore(uid) || 0;
		const newScore = currentScore + parseInt(amount, 10);
		await db.sortedSetAdd('users:helpfulness', newScore, uid);
		return newScore;
	};

	User.getHelpfulnessScore = async function (uid) {
		return await db.sortedSetScore('users:helpfulness', uid) || 0;
	};

	User.getHelpfulnessRank = async function (uid) {
		return await db.sortedSetRevRank('users:helpfulness', uid);
	};

	User.getMostHelpfulUsers = async function (start, stop) {
		const uids = await db.getSortedSetRevRange('users:helpfulness', start, stop);
		return await User.getUsers(uids);
	};

	User.updateHelpfulnessScore = async function (uid) {
		if (parseInt(uid, 10) <= 0) {
			return;
		}

		const [acceptedAnswers, helpfulPosts, totalVotes] = await Promise.all([
			db.sortedSetScore(`uid:${uid}:posts:accepted`, uid) || 0,
			db.sortedSetCount(`uid:${uid}:posts:votes`, 1, '+inf'),
			db.sortedSetScore(`uid:${uid}:posts:votes:total`, uid) || 0,
		]);

		const helpfulnessScore = 
			(acceptedAnswers * 10) + // Weight accepted answers heavily
			totalVotes +             // Add total upvotes
			(helpfulPosts * 2);      // Add bonus for posts with positive votes

		await db.sortedSetAdd('users:helpfulness', helpfulnessScore, uid);

		await plugins.hooks.fire('action:user.helpfulness.updated', { uid, score: helpfulnessScore });
		return helpfulnessScore;
	};
};