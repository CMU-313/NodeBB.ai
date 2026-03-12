'use strict';

const nconf = require('nconf');
const winston = require('winston');

const user = require('./index');
const utils = require('../utils');
const plugins = require('../plugins');
const db = require('../database');
const meta = require('../meta');
const emailer = require('../emailer');
const groups = require('../groups');
const events = require('../events');

const UserEmail = module.exports;

UserEmail.exists = async function (email) {
	const uid = await user.getUidByEmail(email.toLowerCase());
	return !!uid;
};

UserEmail.available = async function (email) {
	const exists = await db.isSortedSetMember('email:uid', email.toLowerCase());
	return !exists;
};

UserEmail.remove = async function (uid, sessionId) {
	const email = await user.getUserField(uid, 'email');
	if (!email) {
		return;
	}

	await Promise.all([
		user.setUserFields(uid, {
			email: '',
			'email:confirmed': 0,
		}),
		db.sortedSetRemoveBulk([
			['email:uid', email.toLowerCase()],
			['email:sorted', `${email.toLowerCase()}:${uid}`],
		]),
		user.email.expireValidation(uid),
		sessionId ? user.auth.revokeAllSessions(uid, sessionId) : Promise.resolve(),
		events.log({
			targetUid: uid,
			type: 'email-change',
			email,
			newEmail: '',
		}),
	]);
};

UserEmail.getEmailForValidation = async (uid) => {
	let email = '';
	const code = await db.get(`confirm:byUid:${uid}`);
	const confirmObj = code ? await db.getObject(`confirm:${code}`) : null;
	if (confirmObj && confirmObj.email && parseInt(uid, 10) === parseInt(confirmObj.uid, 10)) {
		email = confirmObj.email;
	}

	if (!email) {
		email = await user.getUserField(uid, 'email');
	}
	return email;
};

UserEmail.isValidationPending = async (uid, email) => {
	const code = await db.get(`confirm:byUid:${uid}`);
	const confirmObj = await db.getObject(`confirm:${code}`);
	return !!(confirmObj && (
		(!email || email === confirmObj.email) && Date.now() < parseInt(confirmObj.expires, 10)
	));
};

UserEmail.getValidationExpiry = async (uid) => {
	const code = await db.get(`confirm:byUid:${uid}`);
	const confirmObj = await db.getObject(`confirm:${code}`);
	return confirmObj ? Math.max(0, confirmObj.expires - Date.now()) : null;
};

UserEmail.expireValidation = async (uid) => {
	const keys = [`confirm:byUid:${uid}`];
	const code = await db.get(`confirm:byUid:${uid}`);
	if (code) {
		keys.push(`confirm:${code}`);
	}
	await db.deleteAll(keys);
};

UserEmail.canSendValidation = async (uid, email) => {
	const pending = await UserEmail.isValidationPending(uid, email);
	if (!pending) {
		return true;
	}

	const ttl = await UserEmail.getValidationExpiry(uid);
	const max = meta.config.emailConfirmExpiry * 60 * 60 * 1000;
	const interval = meta.config.emailConfirmInterval * 60 * 1000;

	return (ttl || Date.now()) + interval < max;
};

function normalizeValidationOptions(options) {
	if (!options) {
		return {};
	}

	if (typeof options === 'string') {
		return { email: options };
	}

	return options;
}

async function resolveValidationEmail(uid, options) {
	if (options.email && options.email.length) {
		return options.email;
	}

	return await user.getUserField(uid, 'email');
}

function ensureValidationEnabled(uid) {
	if (meta.config.sendValidationEmail !== 1) {
		winston.verbose(`[user/email] Validation email for uid ${uid} not sent due to config settings`);
		return false;
	}
	return true;
}

function ensureValidationEmailExists(uid, email) {
	if (!email) {
		winston.warn(`[user/email] No email found for uid ${uid}`);
		return false;
	}
	return true;
}

async function assertValidationCanBeSent(uid, email, force) {
	if (force) {
		return;
	}

	const canSend = await UserEmail.canSendValidation(uid, email);
	if (!canSend) {
		throw new Error(`[[error:confirm-email-already-sent, ${meta.config.emailConfirmInterval}]]`);
	}
}

async function buildValidationPayload(uid, email, options, confirmCode) {
	const username = await user.getUserField(uid, 'username');
	const confirmLink = `${nconf.get('url')}/confirm/${confirmCode}`;

	return await plugins.hooks.fire('filter:user.verify', {
		uid,
		username,
		confirm_link: confirmLink,
		confirm_code: confirmCode,
		email,

		subject: options.subject || '[[email:email.verify-your-email.subject]]',
		template: options.template || 'verify-email',
	});
}

async function saveValidationRequest(uid, email, confirmCode) {
	const expires = Date.now() + (meta.config.emailConfirmExpiry * 60 * 60 * 1000);

	await UserEmail.expireValidation(uid);
	await db.set(`confirm:byUid:${uid}`, confirmCode);
	await db.setObject(`confirm:${confirmCode}`, {
		email: email.toLowerCase(),
		uid: uid,
		expires,
	});
}

async function dispatchValidationEmail(uid, data) {
	if (plugins.hooks.hasListeners('action:user.verify')) {
		plugins.hooks.fire('action:user.verify', { uid, data });
		return;
	}

	await emailer.send(data.template, uid, data);
}

function logValidationEmailSent(uid, email, confirmCode, options) {
	winston.verbose(`[user/email] Validation email for uid ${uid} sent to ${email}`);
	events.log({
		type: 'email-confirmation-sent',
		uid,
		confirm_code: confirmCode,
		...options,
	});
}

UserEmail.sendValidationEmail = async function (uid, options) {
	/*
	 * Options:
	 * - email, overrides email retrieval
	 * - force, sends email even if it is too soon to send another
	 * - template, changes the template used for email sending
	 */

	if (!ensureValidationEnabled(uid)) {
		return;
	}

	options = normalizeValidationOptions(options);

	const email = await resolveValidationEmail(uid, options);
	if (!ensureValidationEmailExists(uid, email)) {
		return;
	}

	await assertValidationCanBeSent(uid, email, options.force);

	const confirmCode = utils.generateUUID();
	const data = await buildValidationPayload(uid, email, options, confirmCode);

	await saveValidationRequest(uid, email, confirmCode);
	logValidationEmailSent(uid, email, confirmCode, options);
	await dispatchValidationEmail(uid, data);

	return confirmCode;
};

// confirm email by code sent by confirmation email
UserEmail.confirmByCode = async function (code, sessionId) {
	const confirmObj = await db.getObject(`confirm:${code}`);
	if (!confirmObj || !confirmObj.uid || !confirmObj.email) {
		throw new Error('[[error:invalid-data]]');
	}

	if (!confirmObj.expires || Date.now() > parseInt(confirmObj.expires, 10)) {
		throw new Error('[[error:confirm-email-expired]]');
	}

	const oldUid = await db.sortedSetScore('email:uid', confirmObj.email.toLowerCase());
	if (oldUid) {
		await UserEmail.remove(oldUid, sessionId);
	}

	const oldEmail = await user.getUserField(confirmObj.uid, 'email');
	if (oldEmail && confirmObj.email !== oldEmail) {
		await UserEmail.remove(confirmObj.uid, sessionId);
	} else {
		await user.auth.revokeAllSessions(confirmObj.uid, sessionId);
	}

	await user.setUserField(confirmObj.uid, 'email', confirmObj.email);
	await Promise.all([
		UserEmail.confirmByUid(confirmObj.uid),
		db.delete(`confirm:${code}`),
		events.log({
			type: 'email-change',
			oldEmail,
			newEmail: confirmObj.email,
			targetUid: confirmObj.uid,
		}),
	]);
};

// confirm uid's email via ACP
UserEmail.confirmByUid = async function (uid, callerUid = 0) {
	if (!(parseInt(uid, 10) > 0)) {
		throw new Error('[[error:invalid-uid]]');
	}
	callerUid = callerUid || uid;
	const currentEmail = await user.getUserField(uid, 'email');
	if (!currentEmail) {
		throw new Error('[[error:invalid-email]]');
	}

	const oldUid = await db.sortedSetScore('email:uid', currentEmail.toLowerCase());
	if (oldUid && oldUid !== parseInt(uid, 10)) {
		throw new Error('[[error:email-taken]]');
	}

	const confirmedEmails = await db.getSortedSetRangeByScore(`email:uid`, 0, -1, uid, uid);
	if (confirmedEmails.length) {
		await db.sortedSetsRemoveRangeByScore([`email:uid`], uid, uid);
		await db.sortedSetRemoveBulk(
			confirmedEmails.map(email => [`email:sorted`, `${email.toLowerCase()}:${uid}`])
		);
	}
	await Promise.all([
		db.sortedSetAddBulk([
			['email:uid', uid, currentEmail.toLowerCase()],
			['email:sorted', 0, `${currentEmail.toLowerCase()}:${uid}`],
			[`user:${uid}:emails`, Date.now(), `${currentEmail}:${Date.now()}:${callerUid}`],
		]),
		user.setUserField(uid, 'email:confirmed', 1),
		groups.join('verified-users', uid),
		groups.leave('unverified-users', uid),
		user.email.expireValidation(uid),
		user.reset.cleanByUid(uid),
	]);
	await plugins.hooks.fire('action:user.email.confirmed', { uid: uid, email: currentEmail });
};