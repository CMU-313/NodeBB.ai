'use strict';

const validator = require('validator');

const meta = require('../meta');
const db = require('../database');
const activitypub = require('../activitypub');
const plugins = require('../plugins');
const notifications = require('../notifications');
const languages = require('../languages');

const spiderDefaultSettings = {
	usePagination: 1,
	topicPostSort: 'oldest_to_newest',
	postsPerPage: 20,
	topicsPerPage: 20,
};

const remoteDefaultSettings = Object.freeze({
	categoryWatchState: 'notwatching',
});

const BOOLEAN_SETTINGS = Object.freeze({
	showemail: 0,
	showfullname: 0,
	openOutgoingLinksInNewTab: 0,
	usePagination: 0,
	followTopicsOnCreate: 1,
	followTopicsOnReply: 0,
	disableIncomingChats: 0,
	topicSearchEnabled: 0,
	updateUrlWithPostIndex: 1,
	scrollToMyPost: 1,
});

const STRING_SETTINGS = Object.freeze({
	dailyDigestFreq: 'off',
	topicPostSort: 'oldest_to_newest',
	categoryTopicSort: 'recently_replied',
	upvoteNotifFreq: 'all',
	categoryWatchState: 'notwatching',
});

function parseJSONSetting(value, defaultValue) {
	try {
		return JSON.parse(value);
	} catch (err) {
		return defaultValue;
	}
}

function getSetting(settings, key, defaultValue) {
	if (settings[key] || settings[key] === 0) {
		return settings[key];
	} else if (activitypub.helpers.isUri(settings.uid) && remoteDefaultSettings[key]) {
		return remoteDefaultSettings[key];
	} else if (meta.config[key] || meta.config[key] === 0) {
		return meta.config[key];
	}
	return defaultValue;
}

async function onSettingsLoaded(uid, settings) {
	const data = await plugins.hooks.fire('filter:user.getSettings', { uid: uid, settings: settings });
	settings = data.settings;

	for (const [key, defaultVal] of Object.entries(BOOLEAN_SETTINGS)) {
		settings[key] = parseInt(getSetting(settings, key, defaultVal), 10) === 1;
	}
	for (const [key, defaultVal] of Object.entries(STRING_SETTINGS)) {
		settings[key] = getSetting(settings, key, defaultVal);
	}

	const defaultTopicsPerPage = meta.config.topicsPerPage;
	const defaultPostsPerPage = meta.config.postsPerPage;
	settings.topicsPerPage = Math.min(
		meta.config.maxTopicsPerPage,
		settings.topicsPerPage ? parseInt(settings.topicsPerPage, 10) : defaultTopicsPerPage,
		defaultTopicsPerPage
	);
	settings.postsPerPage = Math.min(
		meta.config.maxPostsPerPage,
		settings.postsPerPage ? parseInt(settings.postsPerPage, 10) : defaultPostsPerPage,
		defaultPostsPerPage
	);

	settings.userLang = settings.userLang || meta.config.defaultLang || 'en-GB';
	settings.acpLang = settings.acpLang || settings.userLang;
	settings.bootswatchSkin = validator.escape(String(settings.bootswatchSkin || ''));
	settings.homePageRoute = validator.escape(String(settings.homePageRoute || '')).replace(/&#x2F;/g, '/');

	const notificationTypes = await notifications.getAllNotificationTypes();
	notificationTypes.forEach((notificationType) => {
		settings[notificationType] = getSetting(settings, notificationType, 'notification');
	});

	settings.chatAllowList = parseJSONSetting(settings.chatAllowList || '[]', []).map(String);
	settings.chatDenyList = parseJSONSetting(settings.chatDenyList || '[]', []).map(String);
	return settings;
}

async function getSettings(uid) {
	if (parseInt(uid, 10) <= 0) {
		const isSpider = parseInt(uid, 10) === -1;
		return await onSettingsLoaded(uid, isSpider ? spiderDefaultSettings : {});
	}
	let settings = await db.getObject(`user:${uid}:settings`);
	settings = settings || {};
	settings.uid = uid;
	return await onSettingsLoaded(uid, settings);
}

async function getMultipleUserSettings(uids) {
	if (!Array.isArray(uids) || !uids.length) {
		return [];
	}
	const keys = uids.map(uid => `user:${uid}:settings`);
	let settings = await db.getObjects(keys);
	settings = settings.map((userSettings, index) => {
		userSettings = userSettings || {};
		userSettings.uid = uids[index];
		return userSettings;
	});
	return await Promise.all(settings.map(s => onSettingsLoaded(s.uid, s)));
}

async function validatePagination(data) {
	const maxPostsPerPage = meta.config.maxPostsPerPage || 20;
	if (!data.postsPerPage || parseInt(data.postsPerPage, 10) <= 1 || parseInt(data.postsPerPage, 10) > maxPostsPerPage) {
		throw new Error(`[[error:invalid-pagination-value, 2, ${maxPostsPerPage}]]`);
	}
	const maxTopicsPerPage = meta.config.maxTopicsPerPage || 20;
	if (!data.topicsPerPage || parseInt(data.topicsPerPage, 10) <= 1 || parseInt(data.topicsPerPage, 10) > maxTopicsPerPage) {
		throw new Error(`[[error:invalid-pagination-value, 2, ${maxTopicsPerPage}]]`);
	}
	return { maxPostsPerPage, maxTopicsPerPage };
}

async function validateLanguage(data) {
	const languageCodes = await languages.listCodes();
	if (data.userLang && !languageCodes.includes(data.userLang)) {
		throw new Error('[[error:invalid-language]]');
	}
	if (data.acpLang && !languageCodes.includes(data.acpLang)) {
		throw new Error('[[error:invalid-language]]');
	}
	data.userLang = data.userLang || meta.config.defaultLang;
}

async function saveSettings(uid, data) {
	const { maxPostsPerPage, maxTopicsPerPage } = await validatePagination(data);
	await validateLanguage(data);

	plugins.hooks.fire('action:user.saveSettings', { uid: uid, settings: data });

	const settings = {
		showemail: data.showemail,
		showfullname: data.showfullname,
		openOutgoingLinksInNewTab: data.openOutgoingLinksInNewTab,
		dailyDigestFreq: data.dailyDigestFreq || 'off',
		usePagination: data.usePagination,
		topicsPerPage: Math.min(data.topicsPerPage, parseInt(maxTopicsPerPage, 10) || 20),
		postsPerPage: Math.min(data.postsPerPage, parseInt(maxPostsPerPage, 10) || 20),
		userLang: data.userLang || meta.config.defaultLang,
		acpLang: data.acpLang || meta.config.defaultLang,
		followTopicsOnCreate: data.followTopicsOnCreate,
		followTopicsOnReply: data.followTopicsOnReply,
		disableIncomingChats: data.disableIncomingChats,
		topicSearchEnabled: data.topicSearchEnabled,
		updateUrlWithPostIndex: data.updateUrlWithPostIndex,
		homePageRoute: ((data.homePageRoute === 'custom' ? data.homePageCustom : data.homePageRoute) || '').replace(/^\//, ''),
		scrollToMyPost: data.scrollToMyPost,
		upvoteNotifFreq: data.upvoteNotifFreq,
		bootswatchSkin: data.bootswatchSkin,
		categoryWatchState: data.categoryWatchState,
		categoryTopicSort: data.categoryTopicSort,
		topicPostSort: data.topicPostSort,
		chatAllowList: data.chatAllowList,
		chatDenyList: data.chatDenyList,
	};

	const notificationTypes = await notifications.getAllNotificationTypes();
	notificationTypes.forEach((notificationType) => {
		if (data[notificationType]) {
			settings[notificationType] = data[notificationType];
		}
	});

	const result = await plugins.hooks.fire('filter:user.saveSettings', { uid: uid, settings: settings, data: data });
	await db.setObject(`user:${uid}:settings`, result.settings);
	await updateDigestSetting(uid, data.dailyDigestFreq);
	return await getSettings(uid);
}

async function updateDigestSetting(uid, dailyDigestFreq) {
	await db.sortedSetsRemove(['digest:day:uids', 'digest:week:uids', 'digest:month:uids'], uid);
	if (['day', 'week', 'biweek', 'month'].includes(dailyDigestFreq)) {
		await db.sortedSetAdd(`digest:${dailyDigestFreq}:uids`, Date.now(), uid);
	}
}

async function setSetting(uid, key, value) {
	if (parseInt(uid, 10) <= 0) {
		return;
	}
	await db.setObjectField(`user:${uid}:settings`, key, value);
}

// Factory just wires implementations onto the User object — no logic here
module.exports = function (User) {
	User.getSettings = getSettings;
	User.getMultipleUserSettings = getMultipleUserSettings;
	User.saveSettings = saveSettings;
	User.updateDigestSetting = updateDigestSetting;
	User.setSetting = setSetting;
};