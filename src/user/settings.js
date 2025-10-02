
'use strict';

const validator = require('validator');

const meta = require('../meta');
const db = require('../database');
const activitypub = require('../activitypub');
const plugins = require('../plugins');
const notifications = require('../notifications');
const languages = require('../languages');

// Constants & defaults
const spiderDefaultSettings = {
	usePagination: 1,
	topicPostSort: 'oldest_to_newest',
	postsPerPage: 20,
	topicsPerPage: 20,
};
const remoteDefaultSettings = Object.freeze({
	categoryWatchState: 'notwatching',
});

// Helper utilities (hoisted to reduce complexity in exported function)
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

async function enhanceNotificationSettings(settings) {
	const notificationTypes = await notifications.getAllNotificationTypes();
	notificationTypes.forEach((notificationType) => {
		settings[notificationType] = getSetting(settings, notificationType, 'notification');
	});
	return settings;
}

async function onSettingsLoaded(uid, settings) {
	const data = await plugins.hooks.fire('filter:user.getSettings', { uid: uid, settings: settings });
	settings = data.settings;

	const defaultTopicsPerPage = meta.config.topicsPerPage;
	const defaultPostsPerPage = meta.config.postsPerPage;

	settings.showemail = parseInt(getSetting(settings, 'showemail', 0), 10) === 1;
	settings.showfullname = parseInt(getSetting(settings, 'showfullname', 0), 10) === 1;
	settings.openOutgoingLinksInNewTab = parseInt(getSetting(settings, 'openOutgoingLinksInNewTab', 0), 10) === 1;
	settings.dailyDigestFreq = getSetting(settings, 'dailyDigestFreq', 'off');
	settings.usePagination = parseInt(getSetting(settings, 'usePagination', 0), 10) === 1;
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
	settings.topicPostSort = getSetting(settings, 'topicPostSort', 'oldest_to_newest');
	settings.categoryTopicSort = getSetting(settings, 'categoryTopicSort', 'recently_replied');
	settings.followTopicsOnCreate = parseInt(getSetting(settings, 'followTopicsOnCreate', 1), 10) === 1;
	settings.followTopicsOnReply = parseInt(getSetting(settings, 'followTopicsOnReply', 0), 10) === 1;
	settings.upvoteNotifFreq = getSetting(settings, 'upvoteNotifFreq', 'all');
	settings.disableIncomingChats = parseInt(getSetting(settings, 'disableIncomingChats', 0), 10) === 1;
	settings.topicSearchEnabled = parseInt(getSetting(settings, 'topicSearchEnabled', 0), 10) === 1;
	settings.updateUrlWithPostIndex = parseInt(getSetting(settings, 'updateUrlWithPostIndex', 1), 10) === 1;
	settings.bootswatchSkin = validator.escape(String(settings.bootswatchSkin || ''));
	settings.homePageRoute = validator.escape(String(settings.homePageRoute || '')).replace(/&#x2F;/g, '/');
	settings.scrollToMyPost = parseInt(getSetting(settings, 'scrollToMyPost', 1), 10) === 1;
	settings.categoryWatchState = getSetting(settings, 'categoryWatchState', 'notwatching');

	await enhanceNotificationSettings(settings);

	settings.chatAllowList = parseJSONSetting(settings.chatAllowList || '[]', []).map(String);
	settings.chatDenyList = parseJSONSetting(settings.chatDenyList || '[]', []).map(String);
	return settings;
}

// Validation & construction helpers
function validatePagination(field, value, max) {
	const intVal = parseInt(value, 10);
	if (!intVal || intVal <= 1 || intVal > max) {
		throw new Error(`[[error:invalid-pagination-value, 2, ${max}]]`);
	}
}

async function validateLanguages(data) {
	const languageCodes = await languages.listCodes();
	if (data.userLang && !languageCodes.includes(data.userLang)) {
		throw new Error('[[error:invalid-language]]');
	}
	if (data.acpLang && !languageCodes.includes(data.acpLang)) {
		throw new Error('[[error:invalid-language]]');
	}
	data.userLang = data.userLang || meta.config.defaultLang;
}

function buildSettingsObject(data, maxTopicsPerPage, maxPostsPerPage) {
	return {
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
}

async function applyNotificationSettings(settings, data) {
	const notificationTypes = await notifications.getAllNotificationTypes();
	notificationTypes.forEach((notificationType) => {
		if (data[notificationType]) {
			settings[notificationType] = data[notificationType];
		}
	});
}

module.exports = function (User) {

	User.getSettings = async function (uid) {
		if (parseInt(uid, 10) <= 0) {
			const isSpider = parseInt(uid, 10) === -1;
			return await onSettingsLoaded(uid, isSpider ? spiderDefaultSettings : {});
		}
		let settings = await db.getObject(`user:${uid}:settings`);
		settings = settings || {};
		settings.uid = uid;
		return await onSettingsLoaded(uid, settings);
	};

	User.getMultipleUserSettings = async function (uids) {
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
	};

	User.saveSettings = async function (uid, data) {
		validatePagination('postsPerPage', data.postsPerPage, meta.config.maxPostsPerPage || 20);
		validatePagination('topicsPerPage', data.topicsPerPage, meta.config.maxTopicsPerPage || 20);
		await validateLanguages(data);

		plugins.hooks.fire('action:user.saveSettings', { uid: uid, settings: data });

		const maxPostsPerPage = meta.config.maxPostsPerPage || 20;
		const maxTopicsPerPage = meta.config.maxTopicsPerPage || 20;
		const normalised = buildSettingsObject(data, maxTopicsPerPage, maxPostsPerPage);
		await applyNotificationSettings(normalised, data);
		const result = await plugins.hooks.fire('filter:user.saveSettings', { uid: uid, settings: normalised, data: data });
		await db.setObject(`user:${uid}:settings`, result.settings);
		await User.updateDigestSetting(uid, data.dailyDigestFreq);
		return await User.getSettings(uid);
	};

	User.updateDigestSetting = async function (uid, dailyDigestFreq) {
		await db.sortedSetsRemove(['digest:day:uids', 'digest:week:uids', 'digest:month:uids'], uid);
		if (['day', 'week', 'biweek', 'month'].includes(dailyDigestFreq)) {
			await db.sortedSetAdd(`digest:${dailyDigestFreq}:uids`, Date.now(), uid);
		}
	};

	User.setSetting = async function (uid, key, value) {
		if (parseInt(uid, 10) <= 0) {
			return;
		}

		await db.setObjectField(`user:${uid}:settings`, key, value);
	};
};
