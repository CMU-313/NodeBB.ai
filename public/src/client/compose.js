'use strict';


define('forum/compose', ['hooks'], function (hooks) {
	const Compose = {};

	Compose.addVisibilityOptions = function () {
		const visibilityContainer = $('<div class="visibility-options">').appendTo('.composer');
		visibilityContainer.append('<label for="visibility">Visibility:</label>');
		const select = $('<select id="visibility" name="visibility">')
			.append('<option value="public">Public</option>')
			.append('<option value="private">Private</option>')
			.append('<option value="specific">Specific TAs/Professors</option>');
		visibilityContainer.append(select);
	};

	Compose.init = function () {
		const container = $('.composer');

		if (container.length) {
			hooks.fire('action:composer.enhance', {
				container: container,
			});
			Compose.addVisibilityOptions();
		}
	};

	return Compose;
});
