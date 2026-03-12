'use strict';

const factory = require('./translator.common');

define('translator', ['jquery', 'utils'], function (jQuery, utils) {
	function handleData(data, language, namespace, resolve) {
		require(['hooks'], function (hooks) {
			const payload = {
				language: language,
				namespace: namespace,
				data: data,
			};
			hooks.fire('action:translator.loadClient', payload);
			resolve(payload.promise ? Promise.resolve(payload.promise) : data);
		});
	}

	function loadClient(language, namespace) {
		const url = [config.asset_base_url, 'language', language, namespace].join('/') + '.json?' + config['cache-buster'];

		return new Promise(function (resolve, reject) {
			jQuery.getJSON(url)
				.done(function (data) {
					handleData(data, language, namespace, resolve);
				})
				.fail(function (jqxhr, textStatus, error) {
					reject(new Error(textStatus + ', ' + error));
				});
		});
	}

	const warn = function () { console.warn.apply(console, arguments); };

	return factory(utils, loadClient, warn);
});