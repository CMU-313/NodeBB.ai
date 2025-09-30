'use strict';

const helpers = require('./helpers');

const { setupPageRoute } = helpers;

module.exports = function (app, middleware, controllers) {
	setupPageRoute(app, '/resources', [], controllers.resources.get);
};
