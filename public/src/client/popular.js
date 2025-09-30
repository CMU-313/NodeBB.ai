'use strict';


define('forum/popular', ['topicList', 'sort'], function (topicList, sort) {
	const Popular = {};

	Popular.init = function () {
		app.enterRoom('popular_topics');

		topicList.init('popular');
		sort.handleSort('categoryTopicSort', 'popular');
	};

	return Popular;
});
