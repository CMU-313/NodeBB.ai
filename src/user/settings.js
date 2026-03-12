'use strict';

const validator = require('validator');

const meta = require('../meta');
const db = require('../database');
const activitypub = require('../activitypub');
const plugins = require('../plugins');
const notifications = require('../notifications');
const languages = require('../languages');

module.exports = function (User) {
	const spiderDefaultSettings = {
		usePagination: 1,
		topicPostSort: 'oldest_to_newest',
		postsPerPage: 20,
		topicsPerPage: 20,
	};

	const remoteDefaultSettings = Object.freeze({
		categoryWatchState: 'notwatching',
	});

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

	async function onSettingsLoaded(uid, settings) {
		const data = await plugins.hooks.fire('filter:user.getSettings', {
			uid: uid,
			settings: settings,
		});

		settings = data.settings;

		applyBooleanSettings(settings);
		applyPaginationSettings(settings);
		applyLanguageSettings(settings);
		applyTopicSettings(settings);
		applyMiscSettings(settings);
		await applyNotificationSettings(settings);
		applyChatSettings(settings);

		return settings;
	}

	function applyBooleanSettings(settings) {
		settings.showemail = parseBooleanSetting(settings, 'showemail', 0);
		settings.showfullname = parseBooleanSetting(settings, 'showfullname', 0);
		settings.openOutgoingLinksInNewTab = parseBooleanSetting(settings, 'openOutgoingLinksInNewTab', 0);
		settings.usePagination = parseBooleanSetting(settings, 'usePagination', 0);
		settings.followTopicsOnCreate = parseBooleanSetting(settings, 'followTopicsOnCreate', 1);
		settings.followTopicsOnReply = parseBooleanSetting(settings, 'followTopicsOnReply', 0);
		settings.disableIncomingChats = parseBooleanSetting(settings, 'disableIncomingChats', 0);
		settings.topicSearchEnabled = parseBooleanSetting(settings, 'topicSearchEnabled', 0);
		settings.updateUrlWithPostIndex = parseBooleanSetting(settings, 'updateUrlWithPostIndex', 1);
		settings.scrollToMyPost = parseBooleanSetting(settings, 'scrollToMyPost', 1);
	}

	function applyPaginationSettings(settings) {
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
	}

	function applyLanguageSettings(settings) {
		settings.userLang = settings.userLang || meta.config.defaultLang || 'en-GB';
		settings.acpLang = settings.acpLang || settings.userLang;
	}

	function applyTopicSettings(settings) {
		settings.topicPostSort = getSetting(settings, 'topicPostSort', 'oldest_to_newest');
		settings.categoryTopicSort = getSetting(settings, 'categoryTopicSort', 'recently_replied');
		settings.categoryWatchState = getSetting(settings, 'categoryWatchState', 'notwatching');
	}

	function applyMiscSettings(settings) {
		settings.dailyDigestFreq = getSetting(settings, 'dailyDigestFreq', 'off');
		settings.upvoteNotifFreq = getSetting(settings, 'upvoteNotifFreq', 'all');

		settings.bootswatchSkin = validator.escape(String(settings.bootswatchSkin || ''));

		settings.homePageRoute = validator
			.escape(String(settings.homePageRoute || ''))
			.replace(/&#x2F;/g, '/');
	}

	async function applyNotificationSettings(settings) {
		const notificationTypes = await notifications.getAllNotificationTypes();

		notificationTypes.forEach((notificationType) => {
			settings[notificationType] = getSetting(settings, notificationType, 'notification');
		});
	}

	function applyChatSettings(settings) {
		settings.chatAllowList = parseJSONSetting(settings.chatAllowList || '[]', []).map(String);
		settings.chatDenyList = parseJSONSetting(settings.chatDenyList || '[]', []).map(String);
	}

	function parseBooleanSetting(settings, key, defaultValue) {
		return parseInt(getSetting(settings, key, defaultValue), 10) === 1;
	}

	function parseJSONSetting(value, defaultValue) {
		try {
			return JSON.parse(value);
		} catch (err) {
			return defaultValue;
		}
	}

	function getSetting(settings, key, defaultValue) {
		if (hasUserSetting(settings, key)) {
			return settings[key];
		}
		if (isRemoteUser(settings) && remoteDefaultSettings[key]) {
			return remoteDefaultSettings[key];
		}
		if (hasConfigSetting(key)) {
			return meta.config[key];
		}
		return defaultValue;
	}

	function hasUserSetting(settings, key) {
		return settings[key] || settings[key] === 0;
	}

	function isRemoteUser(settings) {
		return activitypub.helpers.isUri(settings.uid);
	}

	function hasConfigSetting(key) {
		return meta.config[key] || meta.config[key] === 0;
	}

	User.saveSettings = async function (uid, data) {
		validatePostsPerPage(data);
		validateTopicsPerPage(data);
		await validateLanguages(data);

		data.userLang = data.userLang || meta.config.defaultLang;

		plugins.hooks.fire('action:user.saveSettings', { uid: uid, settings: data });

		const settings = buildSettingsObject(data);
		await applyNotificationSettingsToSave(settings, data);

		const result = await plugins.hooks.fire('filter:user.saveSettings', {
			uid: uid,
			settings: settings,
			data: data,
		});

		await db.setObject(`user:${uid}:settings`, result.settings);

		await User.updateDigestSetting(uid, data.dailyDigestFreq);

		return await User.getSettings(uid);
	};

	function validatePostsPerPage(data) {
		const maxPostsPerPage = meta.config.maxPostsPerPage || 20;

		if (
			!data.postsPerPage ||
			parseInt(data.postsPerPage, 10) <= 1 ||
			parseInt(data.postsPerPage, 10) > maxPostsPerPage
		) {
			throw new Error(`[[error:invalid-pagination-value, 2, ${maxPostsPerPage}]]`);
		}
	}

	function validateTopicsPerPage(data) {
		const maxTopicsPerPage = meta.config.maxTopicsPerPage || 20;

		if (
			!data.topicsPerPage ||
			parseInt(data.topicsPerPage, 10) <= 1 ||
			parseInt(data.topicsPerPage, 10) > maxTopicsPerPage
		) {
			throw new Error(`[[error:invalid-pagination-value, 2, ${maxTopicsPerPage}]]`);
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
	}

	function buildSettingsObject(data) {
		const maxTopicsPerPage = meta.config.maxTopicsPerPage || 20;
		const maxPostsPerPage = meta.config.maxPostsPerPage || 20;

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

	async function applyNotificationSettingsToSave(settings, data) {
		const notificationTypes = await notifications.getAllNotificationTypes();

		notificationTypes.forEach((notificationType) => {
			if (data[notificationType]) {
				settings[notificationType] = data[notificationType];
			}
		});
	}

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