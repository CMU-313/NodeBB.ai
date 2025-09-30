'use strict';

define('composer/private', ['composer'], function (composer) {
	const Private = {};

	Private.init = function () {
		$(document).on('change', '#is-private', function () {
			const isPrivate = $(this).prop('checked');
			composer.posts[composer.active].isPrivate = isPrivate;
		});
	};

	return Private;
});