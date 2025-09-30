'use strict';

define('composer/anonymous', [], function () {
	const Anonymous = {};

	Anonymous.init = function (postData) {
		const anonymousCheckbox = $('[component="composer/anonymous"]');
		if (!anonymousCheckbox.length) {
			return;
		}

		anonymousCheckbox.on('change', function () {
			postData.isAnonymous = $(this).prop('checked');
		});
	};

	return Anonymous;
});