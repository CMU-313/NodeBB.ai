'use strict';

const meta = require('../meta');
const plugins = require('../plugins');
const flags = require('../flags');
const translator = require('../translator');

const Profanity = module.exports;

// Simple default list — admins should configure via meta.config['moderation:profanity:list']
Profanity.defaultList = [
	'damn',
	'shit',
	'fuck',
	'bitch',
	'bastard',
	'asshole',
	'crap',
];

function loadList() {
	const raw = meta && meta.config && meta.config['moderation:profanity:list'];
	if (!raw) {
		return Profanity.defaultList;
	}
	if (Array.isArray(raw)) {
		return raw.filter(Boolean).map(String);
	}
	return String(raw).split(/[\s,]+/).filter(Boolean);
}

function buildRegex(list) {
	if (!list || !list.length) {
		return null;
	}
	// word boundary aware, case-insensitive
	const escaped = list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	return new RegExp(`\\b(${escaped.join('|')})\\b`, 'ig');
}

// Replace matched words with asterisks preserving length
function censorText(text, re) {
	if (!re) return { censored: text, found: false };
	let found = false;
	const censored = String(text).replace(re, (m) => {
		found = true;
		return '*'.repeat(Math.max(3, m.length));
	});
	return { censored, found };
}

Profanity.register = function () {
	const list = loadList();
	const re = buildRegex(list);

	// Censor content at parse time so all displays are sanitized
	plugins.hooks.register('core:profanity', {
		hook: 'filter:parse.post',
		method: async (data) => {
			try {
				if (!data || !data.postData || !data.postData.content) return data;
				const { censored, found } = censorText(data.postData.content, re);
				if (found) {
					data.postData.content = censored;
				}
				return data;
			} catch (e) {
				return data;
			}
		},
	});

	// At creation time, optionally auto-flag posts containing profanity
	plugins.hooks.register('core:profanity', {
		hook: 'filter:post.create',
		method: async (payload) => {
			try {
				const post = payload && payload.post;
				if (!post || !post.content) return payload;

				const { found } = censorText(post.content, re);
				const autoFlag = !!meta.config['moderation:profanity:autoFlag'];
				if (found && autoFlag) {
					// System reports with adminUid as reporter
					const adminUid = await require('../user').getFirstAdminUid();
					const reason = await translator.translate('[[flags:auto-flagged-profanity]]').catch(() => 'Auto-flagged for profanity');
					// Fire off a flag but do not block post creation
					try {
						await flags.create('post', post.pid, adminUid, reason, Date.now(), true);
					} catch (err) {
						// ignore errors from flagging
					}
				}
				return payload;
			} catch (e) {
				return payload;
			}
		},
	});
};

// Auto-register when required
Profanity.register();
