
'use strict';

define('forum/topic/time-filter', ['utils', 'hooks'], function (utils, hooks) {
	var module = {};

	module.init = function () {
		// delegate click on dropdown items
		$('body').on('click', '.topic-time-filter .dropdown-item', function (ev) {
			ev.preventDefault();
			var interval = $(this).data('interval') || 'all';
			module.applyFilter(interval);
			hooks.fire('action:topic.timeFilter.changed', interval);
		});
	};

	module.applyFilter = function (interval) {
		var now = Date.now();
		var cutoff = 0; // 0 means show all
		switch (interval) {
			case '24h':
				cutoff = now - (24 * 60 * 60 * 1000);
				break;
			case '7d':
				cutoff = now - (7 * 24 * 60 * 60 * 1000);
				break;
			case '30d':
				cutoff = now - (30 * 24 * 60 * 60 * 1000);
				break;
			case 'all':
			default:
				cutoff = 0;
		}

		// iterate topic list items and hide/show based on first timeago element
		$('li[component="category/topic"]').each(function () {
			var $li = $(this);
			// prefer visible .timeago inside the item
			var $timeEl = $li.find('.timeago').first();
			if (!$timeEl.length) {
				// nothing to compare - keep visible
				$li.show();
				return;
			}
			var iso = $timeEl.attr('title') || $timeEl.attr('data-timestamp') || '';
			if (!iso) {
				$li.show();
				return;
			}
			var t = Date.parse(iso);
			if (!t) {
				$li.show();
				return;
			}
			if (cutoff === 0 || t >= cutoff) {
				$li.show();
			} else {
				$li.hide();
			}
		});

		// store selected label on button
		var label = $('.topic-time-filter [data-interval="' + interval + '"] .flex-grow-1').text() || interval;
		$('.topic-time-filter > button span').text(label);
	};

	return module;
});

