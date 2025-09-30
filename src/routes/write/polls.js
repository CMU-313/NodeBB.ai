"use strict";

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const { setupApiRoute } = routeHelpers;

module.exports = function () {
	const middlewares = [middleware.ensureLoggedIn];

	setupApiRoute(router, 'post', '/', middlewares, controllers.write.polls.create);
	setupApiRoute(router, 'get', '/:pollId', [], controllers.write.polls.get);
	setupApiRoute(router, 'put', '/:pollId/vote', middlewares, controllers.write.polls.vote);
	setupApiRoute(router, 'delete', '/:pollId/vote', middlewares, controllers.write.polls.unvote);

	return router;
};
