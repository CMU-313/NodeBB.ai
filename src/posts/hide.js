'use strict';

const plugins = require('../plugins');
const topics = require('../topics');

module.exports = function (Posts) {
	Posts.hide = async function (pid, uid) {
		return await toggleHide('hide', pid, uid);
	};

	Posts.unhide = async function (pid, uid) {
		return await toggleHide('unhide', pid, uid);
	};

	async function toggleHide(type, pid, uid) {
		const isHiding = type === 'hide';

		await plugins.hooks.fire(`filter:post.${type}`, { pid: pid, uid: uid });

		// set hidden flag and record who hid it
		await Posts.setPostFields(pid, {
			hidden: isHiding ? 1 : 0,
			hiderUid: isHiding ? uid : 0,
		});

		const postData = await Posts.getPostFields(pid, ['pid', 'tid', 'uid', 'content', 'timestamp', 'hidden']);
		const topicData = await topics.getTopicFields(postData.tid, ['tid', 'cid']);
		postData.cid = topicData && topicData.cid;

		plugins.hooks.fire(`action:post.${type}`, { post: Object.assign({}, postData), uid: uid });

		return postData;
	}
};
/*
 * Posts.hide / Posts.unhide
 * Persist a soft 'hidden' flag on a post and record who hid it.
 */
'use strict';

const plugins = require('../plugins');
const topics = require('../topics');

module.exports = function (Posts) {
	Posts.hide = async function (pid, uid) {
		return await toggleHide('hide', pid, uid);
	};

	Posts.unhide = async function (pid, uid) {
		return await toggleHide('unhide', pid, uid);
	};

	async function toggleHide(type, pid, uid) {
		const isHiding = type === 'hide';

		await plugins.hooks.fire(`filter:post.${type}`, { pid: pid, uid: uid });

		// set hidden flag and record who hid it
		await Posts.setPostFields(pid, {
			hidden: isHiding ? 1 : 0,
			hiderUid: isHiding ? uid : 0,
		});

		const postData = await Posts.getPostFields(pid, ['pid', 'tid', 'uid', 'content', 'timestamp', 'hidden']);
		const topicData = await topics.getTopicFields(postData.tid, ['tid', 'cid']);
		postData.cid = topicData && topicData.cid;

		plugins.hooks.fire(`action:post.${type}`, { post: Object.assign({}, postData), uid: uid });

		return postData;
	}
};
 'use strict';

const plugins = require('../plugins');
const topics = require('../topics');

module.exports = function (Posts) {
	Posts.hide = async function (pid, uid) {
		return await toggleHide('hide', pid, uid);
	};

	Posts.unhide = async function (pid, uid) {
		return await toggleHide('unhide', pid, uid);
	};

	async function toggleHide(type, pid, uid) {
		const isHiding = type === 'hide';

		await plugins.hooks.fire(`filter:post.${type}`, { pid: pid, uid: uid });

		// set hidden flag and record who hid it
		await Posts.setPostFields(pid, {
			hidden: isHiding ? 1 : 0,
			hiderUid: isHiding ? uid : 0,
		});

		const postData = await Posts.getPostFields(pid, ['pid', 'tid', 'uid', 'content', 'timestamp', 'hidden']);
		const topicData = await topics.getTopicFields(postData.tid, ['tid', 'cid']);
		postData.cid = topicData && topicData.cid;

		plugins.hooks.fire(`action:post.${type}`, { post: Object.assign({}, postData), uid: uid });

		return postData;
	}
};
