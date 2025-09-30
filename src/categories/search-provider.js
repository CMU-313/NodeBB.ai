'use strict';

const db = require('../database');
const topics = require('../topics');
const plugins = require('../plugins');
const meta = require('../meta');

// Register a hook that provides a minimal, safe category-scoped search.
// It filters topic tids by matching the search term against topic titles.
plugins.hooks.register('core', {
	hook: 'filter:categories.getTopicIds',
	method: async function (payload) {
		try {
			const data = payload.data || {};
			const { cid } = data;
			const queryObj = data.query || data.q || '';

			let term = '';
			if (!queryObj) {
				term = '';
			} else if (typeof queryObj === 'string') {
				term = queryObj;
			} else if (typeof queryObj === 'object') {
				term = queryObj.term || queryObj.search || queryObj.q || queryObj.query || '';
			}

			term = String(term || '').trim();
			if (!term || term.length < 2) {
				// Not a meaningful search; don't modify payload
				return payload;
			}

			const sort = data.sort || (data.settings && data.settings.categoryTopicSort) || meta.config.categoryTopicSort || 'recently_replied';
			const sortToSet = {
				recently_replied: `cid:${cid}:tids`,
				recently_created: `cid:${cid}:tids:create`,
				most_posts: `cid:${cid}:tids:posts`,
				most_votes: `cid:${cid}:tids:votes`,
				most_views: `cid:${cid}:tids:views`,
			};

			const mainSet = sortToSet.hasOwnProperty(sort) ? sortToSet[sort] : `cid:${cid}:tids`;
			const pinnedSet = `cid:${cid}:tids:pinned`;

			const allTids = await db.getSortedSetRange([pinnedSet, mainSet], 0, -1);
			if (!Array.isArray(allTids) || !allTids.length) {
				payload.tids = [];
				return payload;
			}

			const topicFields = await topics.getTopicsFields(allTids, ['title']);
			const tokens = term.toLowerCase().split(/\s+/).filter(Boolean);
			const matchWords = data.matchWords || 'all';

			const matched = allTids.filter((tid, idx) => {
				const t = (topicFields[idx] && topicFields[idx].title) ? String(topicFields[idx].title).toLowerCase() : '';
				if (!t) {
					return false;
				}
				if (matchWords === 'any') {
					return tokens.some(tok => t.includes(tok));
				}
				return tokens.every(tok => t.includes(tok));
			});

			const start = typeof data.start === 'number' ? data.start : (typeof data.start === 'string' && data.start !== '' ? parseInt(data.start, 10) : 0);
			const stop = typeof data.stop === 'number' ? data.stop : (typeof data.stop === 'string' && data.stop !== '' ? parseInt(data.stop, 10) : Math.max(0, matched.length - 1));
			const sliced = matched.slice(start, stop === -1 ? undefined : stop + 1);

			payload.tids = sliced;
			return payload;
		} catch (err) {
			// Avoid breaking category listing on errors
			return payload;
		}
	},
});
