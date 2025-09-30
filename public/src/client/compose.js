'use strict';


define('forum/compose', ['hooks', 'translator'], function (hooks, translator) {
	const Compose = {};

	Compose.init = function () {
		const container = $('.composer');

		if (container.length) {
			hooks.fire('action:composer.enhance', {
				container: container,
			});

			// Add anonymous posting functionality
			addAnonymousCheckbox(container);
		}
	};

	function addAnonymousCheckbox(container) {
		if (!config.allowAnonymousPosts || !app.user.uid) {
			return;
		}

		// Check if checkbox already exists
		if (container.find('[data-anonymous]').length) {
			return;
		}

		// Find the appropriate location to add the checkbox
		// Try to find submit area, then footer, then any container
		let targetContainer = container.find('.composer-submit');
		if (!targetContainer.length) {
			targetContainer = container.find('.compose-footer');
		}
		if (!targetContainer.length) {
			targetContainer = container.find('.composer');
		}
		if (!targetContainer.length) {
			targetContainer = container;
		}

		// Create the anonymous checkbox HTML
		const anonymousHtml = `
			<div class="form-check anonymous-post-option" style="margin: 10px 0;">
				<input type="checkbox" class="form-check-input" id="anonymous-post" data-anonymous>
				<label class="form-check-label" for="anonymous-post">
					Post anonymously
				</label>
			</div>
		`;

		// Insert the checkbox
		if (targetContainer.find('.composer-submit').length) {
			targetContainer.find('.composer-submit').before(anonymousHtml);
		} else {
			targetContainer.append(anonymousHtml);
		}

		// Translate the label
		translator.translate('[[topic:post-anonymously]]', function (translated) {
			container.find('.anonymous-post-option label').text(translated);
		});

		// Hook into form submission
		container.on('submit', 'form', function () {
			const anonymousCheckbox = container.find('[data-anonymous]');
			if (anonymousCheckbox.length && anonymousCheckbox.prop('checked')) {
				const form = $(this);
				// Add hidden input for anonymous flag
				if (!form.find('input[name="anonymous"]').length) {
					form.append('<input type="hidden" name="anonymous" value="true">');
				}
			}
		});
	}

	return Compose;
});
