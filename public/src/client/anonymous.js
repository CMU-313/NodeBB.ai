'use strict';

define('forum/anonymous', [
	'hooks', 'api', 'translator',
], function (hooks, api, translator) {
	const Anonymous = {};

	Anonymous.init = function () {
		hooks.on('action:composer.enhance', function (data) {
			addAnonymousCheckbox(data.container);
		});

		hooks.on('action:composer.post.new', function () {
			// Reset anonymous checkbox when creating new post
			const anonymousCheckbox = $('.composer [data-anonymous]');
			if (anonymousCheckbox.length) {
				anonymousCheckbox.prop('checked', false);
			}
		});

		hooks.on('action:composer.topic.new', function () {
			// Reset anonymous checkbox when creating new topic
			const anonymousCheckbox = $('.composer [data-anonymous]');
			if (anonymousCheckbox.length) {
				anonymousCheckbox.prop('checked', false);
			}
		});

		// Hook into post submission to include anonymous flag
		hooks.on('filter:composer.submit', function (data) {
			const anonymousCheckbox = $('.composer [data-anonymous]');
			if (anonymousCheckbox.length && anonymousCheckbox.prop('checked')) {
				data.anonymous = true;
			}
			return data;
		});
	};

	function addAnonymousCheckbox(composer) {
		if (!config.allowAnonymousPosts || !app.user.uid) {
			return;
		}

		// Check if checkbox already exists
		if (composer.find('[data-anonymous]').length) {
			return;
		}

		// Find the submit button area
		const submitContainer = composer.find('.composer-submit');
		if (!submitContainer.length) {
			return;
		}

		// Create the anonymous checkbox
		const anonymousHtml = `
			<div class="form-check" style="margin-bottom: 10px;">
				<input type="checkbox" class="form-check-input" id="anonymous-post" data-anonymous>
				<label class="form-check-label" for="anonymous-post">
					[[post:post-anonymously]]
				</label>
			</div>
		`;

		// Insert before the submit button
		submitContainer.before(anonymousHtml);

		// Translate the label
		translator.translate('[[post:post-anonymously]]', function (translated) {
			composer.find('[for="anonymous-post"]').text(translated);
		});
	}

	return Anonymous;
});