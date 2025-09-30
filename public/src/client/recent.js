'use strict';

define('forum/recent', ['topicList', 'sort'], function (topicList, sort) {
	const Recent = {};

	Recent.init = function () {
		app.enterRoom('recent_topics');

		topicList.init('recent');
		sort.handleSort('categoryTopicSort', 'recent');
	};

	return Recent;
});
