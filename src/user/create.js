'use strict';

const zxcvbn = require('zxcvbn');

const db = require('../database');
const utils = require('../utils');
const slugify = require('../slugify');
const plugins = require('../plugins');
const groups = require('../groups');
const meta = require('../meta');
const analytics = require('../analytics');

module.exports = function (User) {
	// Refactored User.create function to reduce complexity
	User.create = async function (data) {
		data = preprocessUserData(data);
		await validateUserData(data);

		await lockUserResources(data);

		try {
			const userData = await createUserInDatabase(data);
			await postUserCreationTasks(userData, data);
			return userData.uid;
		} finally {
			await unlockUserResources(data);
		}
	};

	function preprocessUserData(data) {
		data.username = data.username.trim();
		data.userslug = slugify(data.username);
		if (data.email) {
			data.email = String(data.email).trim();
		}
		return data;
	}

	async function validateUserData(data) {
		await User.isDataValid(data);
	}

	async function lockUserResources(data) {
		await lock(data.username, '[[error:username-taken]]');
		if (data.email && data.email !== data.username) {
			await lock(data.email, '[[error:email-taken]]');
		}
	}

	async function unlockUserResources(data) {
		await db.deleteObjectFields('locks', [data.username, data.email]);
	}

	async function createUserInDatabase(data) {
		const timestamp = data.timestamp || Date.now();
		let userData = {
			username: data.username,
			userslug: data.userslug,
			joindate: timestamp,
			lastonline: timestamp,
			status: 'online',
		};
		['picture', 'fullname', 'birthday'].forEach((field) => {
			if (data[field]) {
				userData[field] = data[field];
			}
		});
		if (data.gdpr_consent) userData.gdpr_consent = 1;
		if (data.acceptTos) userData.acceptTos = 1;

		const renamedUsername = await User.uniqueUsername(userData);
		if (renamedUsername) {
			userData.username = renamedUsername;
			userData.userslug = slugify(renamedUsername);
		}

		const results = await plugins.hooks.fire('filter:user.create', { user: userData, data });
		userData = results.user;

		const uid = await db.incrObjectField('global', 'nextUid');
		userData.uid = uid;

		await db.setObject(`user:${uid}`, userData);
		await db.sortedSetAddBulk([
			['username:uid', uid, userData.username],
			[`user:${uid}:usernames`, timestamp, `${userData.username}:${timestamp}`],
			['username:sorted', 0, `${userData.username.toLowerCase()}:${uid}`],
			['userslug:uid', uid, userData.userslug],
			['users:joindate', timestamp, uid],
		]);

		return userData;
	}

	async function postUserCreationTasks(userData, data) {
		await Promise.all([
			analytics.increment('registrations'),
			groups.join(['registered-users', 'unverified-users'], userData.uid),
			storePassword(userData.uid, data.password),
			User.updateDigestSetting(userData.uid, meta.config.dailyDigestFreq),
		]);

		if (data.email) {
			await handleEmailTasks(userData, data);
		}

		plugins.hooks.fire('action:user.create', { user: userData, data });
	}

	async function handleEmailTasks(userData, data) {
		if (userData.uid === 1) {
			await User.setUserField(userData.uid, 'email', data.email);
			await User.email.confirmByUid(userData.uid);
		} else {
			await User.email.sendValidationEmail(userData.uid, {
				email: data.email,
				template: 'welcome',
				subject: `[[email:welcome-to, ${meta.config.title || 'NodeBB'}]]`,
			});
		}
	}

	async function lock(value, error) {
		const count = await db.incrObjectField('locks', value);
		if (count > 1) {
			throw new Error(error);
		}
	}

	async function storePassword(uid, password) {
		if (!password) {
			return;
		}
		const hash = await User.hashPassword(password);
		await Promise.all([
			User.setUserFields(uid, {
				password: hash,
				'password:shaWrapped': 1,
			}),
			User.reset.updateExpiry(uid),
		]);
	}

	User.isDataValid = async function (userData) {
		if (userData.email && !utils.isEmailValid(userData.email)) {
			throw new Error('[[error:invalid-email]]');
		}

		if (!utils.isUserNameValid(userData.username) || !userData.userslug) {
			throw new Error(`[[error:invalid-username, ${userData.username}]]`);
		}

		if (userData.password) {
			User.isPasswordValid(userData.password);
		}

		if (userData.email) {
			const available = await User.email.available(userData.email);
			if (!available) {
				throw new Error('[[error:email-taken]]');
			}
		}
	};

	User.isPasswordValid = function (password, minStrength) {
		minStrength = (minStrength || minStrength === 0) ? minStrength : meta.config.minimumPasswordStrength;

		// Sanity checks: Checks if defined and is string
		if (!password || !utils.isPasswordValid(password)) {
			throw new Error('[[error:invalid-password]]');
		}

		if (password.length < meta.config.minimumPasswordLength) {
			throw new Error('[[reset_password:password-too-short]]');
		}

		if (password.length > 512) {
			throw new Error('[[error:password-too-long]]');
		}

		const strength = zxcvbn(password);
		if (strength.score < minStrength) {
			throw new Error('[[user:weak-password]]');
		}
	};

	User.uniqueUsername = async function (userData) {
		let numTries = 0;
		let { username } = userData;
		while (true) {
			/* eslint-disable no-await-in-loop */
			const exists = await meta.slugTaken(username);
			if (!exists) {
				return numTries ? username : null;
			}
			username = `${userData.username} ${numTries.toString(32)}`;
			numTries += 1;
		}
	};
};
