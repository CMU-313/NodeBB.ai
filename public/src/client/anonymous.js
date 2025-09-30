'use strict';

define('forum/anonymous', [], function () {
	const Anonymous = {};

	Anonymous.init = function () {
		// Hook into composer loading to add anonymous checkbox
		$(window).on('action:composer.loaded', function (ev, data) {
			addAnonymousCheckbox(data.post_uuid);
		});

		// Hook into composer submission to include anonymous flag
		$(window).on('action:composer.submit', function (ev, data) {
			const isAnonymous = $(`[component="composer"][data-uuid="${data.composerData.uuid}"] [component="anonymous/checkbox"]`).is(':checked');
			if (data.composerData.body_raw) {
				data.composerData.anonymous = isAnonymous;
			}
		});
	};

	function addAnonymousCheckbox(uuid) {
		const composerEl = $(`[component="composer"][data-uuid="${uuid}"]`);
		if (composerEl.length && !composerEl.find('[component="anonymous/checkbox"]').length) {
			// Find the composer controls area (usually before submit button)
			const controlsArea = composerEl.find('.composer-submit').parent();
			
			// Create anonymous checkbox HTML
			const anonymousHtml = `
				<div class="form-check" style="margin-right: 10px;">
					<input class="form-check-input" type="checkbox" component="anonymous/checkbox" id="anonymous-${uuid}">
					<label class="form-check-label text-sm" for="anonymous-${uuid}">
						[[anonymous:post-anonymously]]
					</label>
				</div>
			`;
			
			// Insert before submit button
			controlsArea.before(anonymousHtml);
		}
	}

	return Anonymous;
});