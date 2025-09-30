'use strict';

const validator = require('validator');
const nconf = require('nconf');
const _ = require('lodash');

const db = require('../database');
const meta = require('../meta');
const plugins = require('../plugins');
const activitypub = require('../activitypub');
const utils = require('../utils');

const relative_path = nconf.get('relative_path');

const intFields = [
	'uid', 'postcount', 'topiccount', 'reputation', 'profileviews',
	'banned', 'banned:expire', 'email:confirmed', 'joindate', 'lastonline',
	'lastqueuetime', 'lastposttime', 'followingCount', 'followerCount',
	'blocksCount', 'passwordExpiry', 'mutedUntil',
];

module.exports = function (User) {
	const fieldWhitelist = [
		'uid', 'username', 'userslug', 'url', 'email', 'email:confirmed', 'joindate',
		'lastonline', 'picture', 'icon:bgColor', 'fullname', 'birthday',
		'aboutme', 'signature', 'uploadedpicture', 'profileviews', 'reputation',
		'postcount', 'topiccount', 'lastposttime', 'banned', 'banned:expire',
		'status', 'flags', 'followerCount', 'followingCount', 'cover:url',
		'cover:position', 'groupTitle', 'mutedUntil', 'mutedReason',
	];

	let customFieldWhiteList = null;

	User.guestData = {
		uid: 0,
		username: '[[global:guest]]',
		displayname: '[[global:guest]]',
		userslug: '',
		fullname: '[[global:guest]]',
		email: '',
		'icon:text': '?',
		'icon:bgColor': '#aaa',
		groupTitle: '',
		groupTitleArray: [],
		status: 'offline',
		reputation: 0,
		'email:confirmed': 0,
	};

	let iconBackgrounds;

	User.reloadCustomFieldWhitelist = async () => {
		customFieldWhiteList = await db.getSortedSetRange('user-custom-fields', 0, -1);
	};

	User.getUserFieldWhitelist = async function () {
		const { whitelist } = await plugins.hooks.fire('filter:user.whitelistFields', {
			uids: [],
			whitelist: fieldWhitelist.slice(),
		});
		return whitelist;
	};

	User.getUsersFields = async function (uids, fields) {
		if (!Array.isArray(uids) || !uids.length) {
			return [];
		}

		uids = uids.map((uid) => {
			if (utils.isNumber(uid)) {
				return parseInt(uid, 10);
			} else if (activitypub.helpers.isUri(uid)) {
				return uid;
			}

			return 0;
		});

		const fieldsToRemove = [];
		fields = fields.slice();
		ensureRequiredFields(fields, fieldsToRemove);

		const uniqueUids = _.uniq(uids).filter(uid => isFinite(uid) && uid > 0);
		const remoteIds = _.uniq(uids).filter(uid => !isFinite(uid));
		if (!customFieldWhiteList) {
			await User.reloadCustomFieldWhitelist();
		}

		const results = await plugins.hooks.fire('filter:user.whitelistFields', {
			uids: uids,
			whitelist: _.uniq(fieldWhitelist.concat(customFieldWhiteList)),
		});
		if (!fields.length) {
			fields = results.whitelist;
		} else {
			fields = fields.filter(value => value !== 'password');
		}

		const users = await db.getObjectsFields(
			uniqueUids.map(uid => `user:${uid}`).concat(remoteIds.map(id => `userRemote:${id}`)),
			fields
		);
		const result = await plugins.hooks.fire('filter:user.getFields', {
			uids: uniqueUids,
			users: users,
			fields: fields,
		});
		result.users.forEach((user, index) => {
			if (uniqueUids[index] > 0 && !user.uid) {
				user.oldUid = uniqueUids[index];
			}
		});
		await modifyUserData(result.users, fields, fieldsToRemove);
		return uidsToUsers(uids, [...uniqueUids, ...remoteIds], result.users);
	};

	function ensureRequiredFields(fields, fieldsToRemove) {
		function addField(field) {
			if (!fields.includes(field)) {
				fields.push(field);
				fieldsToRemove.push(field);
			}
		}

		if (fields.length && !fields.includes('uid')) {
			fields.push('uid');
		}

		if (fields.includes('picture')) {
			addField('uploadedpicture');
		}

		if (fields.includes('status')) {
			addField('lastonline');
		}

		if (fields.includes('banned') && !fields.includes('banned:expire')) {
			addField('banned:expire');
		}

		if (fields.includes('username') && !fields.includes('fullname')) {
			addField('fullname');
		}
	}

	function uidsToUsers(uids, uniqueUids, usersData) {
		const uidToUser = _.zipObject(uniqueUids, usersData);
		const users = uids.map((uid) => {
			const user = uidToUser[uid] || { ...User.guestData };
			if (!parseInt(user.uid, 10) && !activitypub.helpers.isUri(user.uid)) {
				user.username = (user.hasOwnProperty('oldUid') && parseInt(user.oldUid, 10)) ? '[[global:former-user]]' : '[[global:guest]]';
				user.displayname = user.username;
			}
			if (uid === -1) { // if loading spider set uid to -1 otherwise spiders have uid = 0 like guests
				user.uid = -1;
			}
			return user;
		});
		return users;
	}

	User.getUserField = async function (uid, field) {
		const user = await User.getUserFields(uid, [field]);
		return user && user.hasOwnProperty(field) ? user[field] : null;
	};

	User.getUserFields = async function (uid, fields) {
		const users = await User.getUsersFields([uid], fields);
		return users ? users[0] : null;
	};

	User.getUserData = async function (uid) {
		const users = await User.getUsersData([uid]);
		return users ? users[0] : null;
	};

	User.getUsersData = async function (uids) {
		return await User.getUsersFields(uids, []);
	};

	User.hidePrivateData = async function (users, callerUID) {
		let single = false;
		if (!Array.isArray(users)) {
			users = [users];
			single = true;
		}

		const [userSettings, isAdmin, isGlobalModerator] = await Promise.all([
			User.getMultipleUserSettings(users.map(user => user.uid)),
			User.isAdministrator(callerUID),
			User.isGlobalModerator(callerUID),
		]);

		users = await Promise.all(users.map(async (userData, idx) => {
			const _userData = { ...userData };

			const isSelf = parseInt(callerUID, 10) === parseInt(_userData.uid, 10);
			const privilegedOrSelf = isAdmin || isGlobalModerator || isSelf;

			if (!privilegedOrSelf && (!userSettings[idx].showemail || meta.config.hideEmail)) {
				_userData.email = '';
			}
			if (!privilegedOrSelf && (!userSettings[idx].showfullname || meta.config.hideFullname)) {
				_userData.fullname = '';
			}
			return _userData;
		}));

		return single ? users.pop() : users;
	};

	async function modifyUserData(users, requestedFields, fieldsToRemove) {
		const uidToSettings = await getUidToSettings(users);
		if (!iconBackgrounds) {
			iconBackgrounds = await User.getIconBackgrounds();
		}

		const unbanUids = [];
		users.forEach((user) => {
			if (!user) return;

			processUserFields(user, requestedFields, fieldsToRemove, uidToSettings);
			handleUserBans(user, unbanUids);
		});

		if (unbanUids.length) {
			await User.bans.unban(unbanUids, '[[user:info.ban-expired]]');
		}

		return await plugins.hooks.fire('filter:users.get', users);
	}

	async function getUidToSettings(users) {
		if (!meta.config.showFullnameAsDisplayName) return {};

		const uids = users.map(user => user.uid);
		return _.zipObject(uids, await db.getObjectsFields(
			uids.map(uid => `user:${uid}:settings`),
			['showfullname']
		));
	}

	function processUserFields(user, requestedFields, fieldsToRemove, uidToSettings) {
		db.parseIntFields(user, intFields, requestedFields);

		if (user.hasOwnProperty('username')) {
			parseDisplayName(user, uidToSettings);
			user.username = validator.escape(user.username ? user.username.toString() : '');
		}

		handleUserUrls(user);
		handleUserPictures(user);
		handleUserStatus(user);
		removeFields(user, fieldsToRemove);
	}

	function handleUserUrls(user) {
		if (user.url) {
			user.remoteUrl = user.url;
		} else {
			delete user.url;
		}

		if (user.hasOwnProperty('email')) {
			user.email = validator.escape(user.email ? user.email.toString() : '');
		}

		if (!user.uid && !activitypub.helpers.isUri(user.uid)) {
			Object.assign(user, User.guestData);
			user.picture = User.getDefaultAvatar();
		}
	}

	function handleUserPictures(user) {
		if (user.picture && user.picture === user.uploadedpicture) {
			user.uploadedpicture = user.picture.startsWith('http') ? user.picture : relative_path + user.picture;
			user.picture = user.uploadedpicture;
		} else if (user.uploadedpicture) {
			user.uploadedpicture = user.uploadedpicture.startsWith('http') ? user.uploadedpicture : relative_path + user.uploadedpicture;
		}

		if (meta.config.defaultAvatar && !user.picture) {
			user.picture = User.getDefaultAvatar();
		}
	}

	function handleUserStatus(user) {
		if (user.hasOwnProperty('status') && user.hasOwnProperty('lastonline')) {
			user.status = User.getStatus(user);
		}

		if (user.hasOwnProperty('joindate')) {
			user.joindateISO = utils.toISOString(user.joindate);
		}

		if (user.hasOwnProperty('lastonline')) {
			user.lastonlineISO = utils.toISOString(user.lastonline) || user.joindateISO;
		}

		if (user.hasOwnProperty('mutedUntil')) {
			user.muted = user.mutedUntil > Date.now();
		}
	}

	function removeFields(user, fieldsToRemove) {
		fieldsToRemove.forEach((field) => {
			user[field] = undefined;
		});
	}

	function handleUserBans(user, unbanUids) {
		if (user.hasOwnProperty('banned') || user.hasOwnProperty('banned:expire')) {
			const result = User.bans.calcExpiredFromUserData(user);
			user.banned = result.banned;
			const unban = result.banned && result.banExpired;
			user.banned_until = unban ? 0 : user['banned:expire'];
			user.banned_until_readable = user.banned_until && !unban ? utils.toISOString(user.banned_until) : 'Not Banned';
			if (unban) {
				unbanUids.push(user.uid);
				user.banned = false;
			}
		}

		user.isLocal = utils.isNumber(user.uid);
	}
}
