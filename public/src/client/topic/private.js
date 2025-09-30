'use strict';

define('forum/topic/private', ['components'], function (components) {
	const Private = {};

	Private.init = function () {
		const topicEl = components.get('topic');
		if (parseInt(topicEl.attr('data-private'), 10) === 1) {
			topicEl.addClass('private');
			$('<div class="private-indicator">Private Question</div>')
				.prependTo(topicEl.find('.topic-header'));
		}
	};

	return Private;
});