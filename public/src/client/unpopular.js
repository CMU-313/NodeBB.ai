'use strict';

define('forum/unpopular', ['topicList'], function (topicList) {
	const Unpopular = {};

	Unpopular.init = function () {
		app.enterRoom('unpopular_topics');

		topicList.init('unpopular');
	};

	return Unpopular;
});