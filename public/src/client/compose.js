'use strict';


define('forum/compose', ['hooks'], function (hooks) {
	const Compose = {};

	Compose.init = function () {
		const container = $('.composer');

		if (container.length) {
			hooks.fire('action:composer.enhance', {
				container: container,
			});
		}

		// Add event listener for anonymous checkbox
		container.on('change', '[component="composer/anonymous"]', function () {
			const isAnonymous = $(this).is(':checked');
			container.data('anonymous', isAnonymous);
		});
	};

	return Compose;
});
