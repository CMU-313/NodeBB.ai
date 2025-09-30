'use strict';

const db = require('../database');
const plugins = require('../plugins');

async function validateFollowOperation(User, uid, theiruid) {
	if (parseInt(uid, 10) <= 0 || parseInt(theiruid, 10) <= 0) {
		throw new Error('[[error:invalid-uid]]');
	}

	if (parseInt(uid, 10) === parseInt(theiruid, 10)) {
		throw new Error('[[error:you-cant-follow-yourself]]');
	}

	const [exists, isFollowing] = await Promise.all([
		User.exists(theiruid),
		User.isFollowing(uid, theiruid),
	]);

	if (!exists) {
		throw new Error('[[error:no-user]]');
	}

	return isFollowing;
}

async function handleFollow(uid, theiruid) {
	const now = Date.now();
	await db.sortedSetAddBulk([
		[`following:${uid}`, now, theiruid],
		[`followers:${theiruid}`, now, uid],
	]);
}

async function handleUnfollow(uid, theiruid) {
	await db.sortedSetRemoveBulk([
		[`following:${uid}`, theiruid],
		[`followers:${theiruid}`, uid],
	]);
}

async function updateFollowCounts(User, uid, theiruid) {
	const [followingCount, followingRemoteCount, followerCount, followerRemoteCount] = await db.sortedSetsCard([
		`following:${uid}`, `followingRemote:${uid}`, `followers:${theiruid}`, `followersRemote:${theiruid}`,
	]);
	await Promise.all([
		User.setUserField(uid, 'followingCount', followingCount + followingRemoteCount),
		User.setUserField(theiruid, 'followerCount', followerCount + followerRemoteCount),
	]);
}

async function handleFollowOperation(type, uid, theiruid, User) {
	const isFollowing = await validateFollowOperation(User, uid, theiruid);

	await plugins.hooks.fire('filter:user.toggleFollow', {
		type,
		uid,
		theiruid,
		isFollowing,
	});

	if (type === 'follow') {
		if (isFollowing) {
			throw new Error('[[error:already-following]]');
		}
		await handleFollow(uid, theiruid);
	} else {
		if (!isFollowing) {
			throw new Error('[[error:not-following]]');
		}
		await handleUnfollow(uid, theiruid);
	}

	await updateFollowCounts(User, uid, theiruid);
}

module.exports = {
	validateFollowOperation,
	handleFollow,
	handleUnfollow,
	updateFollowCounts,
	handleFollowOperation,
};