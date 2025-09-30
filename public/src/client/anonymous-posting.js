'use strict';

define('forum/anonymous-posting', ['hooks'], function (hooks) {
	const AnonymousPosting = {};

	AnonymousPosting.init = function () {
		// Hook into composer submit to include anonymous flag
		hooks.on('action:composer.topics.post', function (data) {
			if (data.composerData) {
				const anonymousCheckbox = $('#anonymous-posting-checkbox');
				if (anonymousCheckbox.length && anonymousCheckbox.is(':checked')) {
					data.composerData.isAnonymous = 1;
				}
			}
		});

		hooks.on('action:composer.posts.reply', function (data) {
			if (data.composerData) {
				const anonymousCheckbox = $('#anonymous-posting-checkbox');
				if (anonymousCheckbox.length && anonymousCheckbox.is(':checked')) {
					data.composerData.isAnonymous = 1;
				}
			}
		});

		// Hook into composer form submit
		$(document).on('submit', '.composer form', function () {
			const anonymousCheckbox = $('#anonymous-posting-checkbox');
			if (anonymousCheckbox.length && anonymousCheckbox.is(':checked')) {
				// Add hidden input for anonymous posting
				if (!$(this).find('input[name="isAnonymous"]').length) {
					$(this).append('<input type="hidden" name="isAnonymous" value="1">');
				}
			}
		});
	};

	return AnonymousPosting;
});