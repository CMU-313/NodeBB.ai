'use strict';

define('forum/top', ['topicList', 'sort'], function (topicList, sort) {
	const Top = {};

	Top.init = function () {
		app.enterRoom('top_topics');

		topicList.init('top');
		sort.handleSort('categoryTopicSort', 'top');
	};

	return Top;
});
