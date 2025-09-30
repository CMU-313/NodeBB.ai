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
		settings = await applyPluginFilters(uid, settings);
		settings = applyDefaultSettings(settings);
		settings = await applyNotificationSettings(settings);
		settings = applyChatSettings(settings);
		return settings;
	}

	function applyDefaultSettings(settings) {
		const defaultTopicsPerPage = meta.config.topicsPerPage;
		const defaultPostsPerPage = meta.config.postsPerPage;

		const booleanSettings = [
			['showemail', 0],
			['showfullname', 0],
			['openOutgoingLinksInNewTab', 0],
			['usePagination', 0],
			['followTopicsOnCreate', 1],
			['followTopicsOnReply', 0],
			['disableIncomingChats', 0],
			['topicSearchEnabled', 0],
			['updateUrlWithPostIndex', 1],
			['scrollToMyPost', 1],
		];

		booleanSettings.forEach(([key, defaultValue]) => {
			settings[key] = parseBooleanSetting(settings, key, defaultValue);
		});

		const stringSettings = [
			['dailyDigestFreq', 'off'],
			['topicPostSort', 'oldest_to_newest'],
			['categoryTopicSort', 'recently_replied'],
			['upvoteNotifFreq', 'all'],
			['categoryWatchState', 'notwatching'],
		];

		stringSettings.forEach(([key, defaultValue]) => {
			settings[key] = getSetting(settings, key, defaultValue);
		});

		settings.topicsPerPage = Math.min(
			meta.config.maxTopicsPerPage,
			parseInt(settings.topicsPerPage || defaultTopicsPerPage, 10)
		);
		settings.postsPerPage = Math.min(
			meta.config.maxPostsPerPage,
			parseInt(settings.postsPerPage || defaultPostsPerPage, 10)
		);
		settings.userLang = settings.userLang || meta.config.defaultLang || 'en-GB';
		settings.acpLang = settings.acpLang || settings.userLang;
		settings.bootswatchSkin = validator.escape(String(settings.bootswatchSkin || ''));
		settings.homePageRoute = validator.escape(String(settings.homePageRoute || '')).replace(/&#x2F;/g, '/');
		return settings;
	}

	function parseBooleanSetting(settings, key, defaultValue) {
		return parseInt(getSetting(settings, key, defaultValue), 10) === 1;
	}

	async function applyNotificationSettings(settings) {
		const notificationTypes = await notifications.getAllNotificationTypes();
		notificationTypes.forEach((notificationType) => {
			settings[notificationType] = getSetting(settings, notificationType, 'notification');
		});
		return settings;
	}

	function applyChatSettings(settings) {
		settings.chatAllowList = parseJSONSetting(settings.chatAllowList || '[]', []).map(String);
		settings.chatDenyList = parseJSONSetting(settings.chatDenyList || '[]', []).map(String);
		return settings;
	}

	async function applyPluginFilters(uid, settings) {
		const data = await plugins.hooks.fire('filter:user.getSettings', { uid: uid, settings: settings });
		return data.settings;
	}

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

	User.saveSettings = async function (uid, data) {
		const maxPostsPerPage = meta.config.maxPostsPerPage || 20;
		if (
			!data.postsPerPage ||
			parseInt(data.postsPerPage, 10) <= 1 ||
			parseInt(data.postsPerPage, 10) > maxPostsPerPage
		) {
			throw new Error(`[[error:invalid-pagination-value, 2, ${maxPostsPerPage}]]`);
		}

		const maxTopicsPerPage = meta.config.maxTopicsPerPage || 20;
		if (
			!data.topicsPerPage ||
			parseInt(data.topicsPerPage, 10) <= 1 ||
			parseInt(data.topicsPerPage, 10) > maxTopicsPerPage
		) {
			throw new Error(`[[error:invalid-pagination-value, 2, ${maxTopicsPerPage}]]`);
		}

		const languageCodes = await languages.listCodes();
		if (data.userLang && !languageCodes.includes(data.userLang)) {
			throw new Error('[[error:invalid-language]]');
		}
		if (data.acpLang && !languageCodes.includes(data.acpLang)) {
			throw new Error('[[error:invalid-language]]');
		}
		data.userLang = data.userLang || meta.config.defaultLang;

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
