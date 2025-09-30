
'use strict';

const notifications = require('../notifications');
const plugins = require('../plugins');
const activitypub = require('../activitypub');
const db = require('../database');
const utils = require('../utils');

module.exports = function (User) {
	const followUtils = require('./follow-utils');
	
	User.follow = async function (uid, followuid) {
		return followUtils.handleFollowOperation('follow', uid, followuid, User);
	};

	User.unfollow = async function (uid, unfollowuid) {
		return followUtils.handleFollowOperation('unfollow', uid, unfollowuid, User);
	};

	User.getFollowing = async function (uid, start, stop) {
		return await getFollow(uid, 'following', start, stop);
	};

	User.getFollowers = async function (uid, start, stop) {
		return await getFollow(uid, 'followers', start, stop);
	};

	async function getFollow(uid, type, start, stop) {
		if (parseInt(uid, 10) <= 0) {
			return [];
		}
		let uids = await db.getSortedSetRevRange([
			`${type}:${uid}`,
			`${type}Remote:${uid}`,
		], start, stop);

		// Filter out remote categories
		const isCategory = await db.exists(uids.map(uid => `categoryRemote:${uid}`));
		uids = uids.filter((uid, idx) => !isCategory[idx]);

		const data = await plugins.hooks.fire(`filter:user.${type}`, {
			uids: uids,
			uid: uid,
			start: start,
			stop: stop,
		});
		return await User.getUsers(data.uids, uid);
	}

	User.isFollowing = async function (uid, theirid) {
		const isRemote = activitypub.helpers.isUri(theirid);
		if (parseInt(uid, 10) <= 0 || (!isRemote && (theirid, 10) <= 0)) {
			return false;
		}
		const setPrefix = isRemote ? 'followingRemote' : 'following';
		return await db.isSortedSetMember(`${setPrefix}:${uid}`, theirid);
	};

	User.isFollowPending = async function (uid, target) {
		if (utils.isNumber(target)) {
			return false;
		}

		return await db.isSortedSetMember(`followRequests:uid.${uid}`, target);
	};

	User.onFollow = async function (uid, targetUid) {
		const userData = await User.getUserFields(uid, ['username', 'userslug']);
		const { displayname } = userData;

		const notifObj = await notifications.create({
			type: 'follow',
			bodyShort: `[[notifications:user-started-following-you, ${displayname}]]`,
			nid: `follow:${targetUid}:uid:${uid}`,
			from: uid,
			path: `/user/${userData.userslug}`,
			mergeId: 'notifications:user-started-following-you',
		});
		if (!notifObj) {
			return;
		}
		notifObj.user = userData;
		await notifications.push(notifObj, [targetUid]);
	};
};
