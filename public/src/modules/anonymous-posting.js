/**
 * Anonymous posting functionality for NodeBB
 */

'use strict';

define('forum/anonymous-posting', ['hooks'], function (hooks) {
	const AnonymousPosting = {};

	AnonymousPosting.init = function () {
		// Add anonymous posting hook for topic creation
		hooks.on('action:composer.topic.new', function (data) {
			addAnonymousOption(data);
		});

		// Add anonymous posting hook for post replies
		hooks.on('action:composer.post.new', function (data) {
			addAnonymousOption(data);
		});

		// Add anonymous posting hook for quote replies
		hooks.on('action:composer.addQuote', function (data) {
			addAnonymousOption(data);
		});
	};

	function addAnonymousOption(data) {
		// Check if composer container exists and anonymous option isn't already added
		const composerContainer = $('.composer');
		if (composerContainer.length && !composerContainer.find('[component="anonymous/checkbox"]').length) {
			// Wait a bit for composer to fully load
			setTimeout(function () {
				insertAnonymousCheckbox(composerContainer);
			}, 100);
		}
	}

	function insertAnonymousCheckbox(container) {
		const anonymousHtml = `
			<div class="form-check mb-2" component="anonymous/container">
				<input class="form-check-input" type="checkbox" id="anonymous-post" component="anonymous/checkbox">
				<label class="form-check-label" for="anonymous-post">
					[[anonymous:post-anonymously]]
				</label>
				<small class="form-text text-muted">[[anonymous:anonymous-posting-help]]</small>
			</div>
		`;

		// Try to find the form controls area and insert before submit button
		const formControls = container.find('.form-actions, .composer-footer, .write-container .write');
		if (formControls.length) {
			formControls.first().before(anonymousHtml);
		} else {
			// Fallback: append to the main form area
			container.find('.write-container, .composer-container').first().append(anonymousHtml);
		}
	}

	// Hook into form submission to include anonymous flag
	hooks.on('action:composer.submit', function (data) {
		const anonymousCheckbox = $('[component="anonymous/checkbox"]');
		if (anonymousCheckbox.length && anonymousCheckbox.is(':checked')) {
			data.anonymous = 1;
		}
	});

	return AnonymousPosting;
});