'use strict';

const async = require('async');
const passport = require('passport');
const passportLocal = require('passport-local').Strategy;
const BearerStrategy = require('passport-http-bearer').Strategy;
const winston = require('winston');

const controllers = require('../controllers');
const helpers = require('../controllers/helpers');
const plugins = require('../plugins');
const api = require('../api');
const { generateToken } = require('../middleware/csrf');

let loginStrategies = [];

const Auth = module.exports;

Auth.initialize = function (app, middleware) {
	app.use(passport.initialize());
	app.use(passport.session());
	app.use((req, res, next) => {
		Auth.setAuthVars(req, res);
		next();
	});

	Auth.app = app;
	Auth.middleware = middleware;
};

Auth.setAuthVars = function setAuthVars(req) {
	const isSpider = req.isSpider();
	req.loggedIn = !isSpider && !!req.user;
	if (req.user) {
		req.uid = parseInt(req.user.uid, 10);
	} else if (isSpider) {
		req.uid = -1;
	} else {
		req.uid = 0;
	}
};

Auth.getLoginStrategies = function () {
	return loginStrategies;
};

Auth.verifyToken = async function (token, done) {
	const tokenObj = await api.utils.tokens.get(token);
	const uid = tokenObj ? tokenObj.uid : undefined;

	if (uid !== undefined) {
		if (parseInt(uid, 10) > 0) {
			done(null, {
				uid: uid,
			});
		} else {
			done(null, {
				master: true,
			});
		}
	} else {
		done(false);
	}
};

function registerLocalLoginStrategy() {
	if (plugins.hooks.hasListeners('action:auth.overrideLogin')) {
		winston.warn('[authentication] Login override detected, skipping local login strategy.');
		plugins.hooks.fire('action:auth.overrideLogin');
		return;
	}

	passport.use(new passportLocal({ passReqToCallback: true }, controllers.authentication.localLogin));
}

async function loadLoginStrategies() {
	try {
		return await plugins.hooks.fire('filter:auth.init', loginStrategies);
	} catch (err) {
		winston.error(`[authentication] ${err.stack}`);
		return loginStrategies;
	}
}

function registerStrategyAuthRoute(router, strategy) {
	if (!strategy.url) {
		return;
	}

	router[strategy.urlMethod || 'get'](strategy.url, Auth.middleware.applyCSRF, async (req, res, next) => {
		let opts = {
			scope: strategy.scope,
			prompt: strategy.prompt || undefined,
		};

		if (strategy.checkState !== false) {
			req.session.ssoState = generateToken(req, true);
			opts.state = req.session.ssoState;
		}
		if (req.query.next) {
			req.session.next = req.query.next;
		}

		// Allow SSO plugins to override/append options (for use in passport prototype authorizationParams)
		({ opts } = await plugins.hooks.fire('filter:auth.options', { req, res, opts }));
		passport.authenticate(strategy.name, opts)(req, res, next);
	});
}

function validateCallbackState(strategy) {
	return function (req, res, next) {
		if (strategy.checkState === false) {
			return next();
		}

		next(req.query.state !== req.session.ssoState ? new Error('[[error:csrf-invalid]]') : null);
	};
}

function authenticateStrategyCallback(strategy) {
	return function (req, res, next) {
		// Trigger registration interstitial checks
		req.session.registration = req.session.registration || {};
		// save returnTo for later usage in /register/complete
		// passport seems to remove `req.session.returnTo` after it redirects
		req.session.registration.returnTo = req.session.next || req.session.returnTo;

		passport.authenticate(strategy.name, (err, user) => {
			if (err) {
				if (req.session && req.session.registration) {
					delete req.session.registration;
				}
				return next(err);
			}

			if (!user) {
				if (req.session && req.session.registration) {
					delete req.session.registration;
				}
				return helpers.redirect(res, strategy.failureUrl !== undefined ? strategy.failureUrl : '/login');
			}

			res.locals.user = user;
			res.locals.strategy = strategy;
			next();
		})(req, res, next);
	};
}

function finishStrategyLogin(strategy) {
	return function (req, res, next) {
		async.waterfall([
			async.apply(req.login.bind(req), res.locals.user, { keepSessionInfo: true }),
			async.apply(controllers.authentication.onSuccessfulLogin, req, res.locals.user.uid),
		], (err) => {
			if (err) {
				return next(err);
			}

			helpers.redirect(res, strategy.successUrl !== undefined ? strategy.successUrl : '/');
		});
	};
}

function registerStrategyCallbackRoute(router, strategy) {
	router[strategy.callbackMethod || 'get'](
		strategy.callbackURL,
		validateCallbackState(strategy),
		authenticateStrategyCallback(strategy),
		Auth.middleware.validateAuth,
		finishStrategyLogin(strategy)
	);
}

function registerBaseAuthRoutes(router) {
	const multipart = require('connect-multiparty');
	const multipartMiddleware = multipart();
	const middlewares = [multipartMiddleware, Auth.middleware.applyCSRF, Auth.middleware.applyBlacklist];

	router.post('/register', middlewares, controllers.authentication.register);
	router.post('/register/complete', middlewares, controllers.authentication.registerComplete);
	router.post('/register/abort', middlewares, controllers.authentication.registerAbort);
	router.post('/login', Auth.middleware.applyCSRF, Auth.middleware.applyBlacklist, controllers.authentication.login);
	router.post('/logout', Auth.middleware.applyCSRF, controllers.authentication.logout);
}

Auth.reloadRoutes = async function (params) {
	loginStrategies.length = 0;
	const { router } = params;

	registerLocalLoginStrategy();

	passport.use('core.api', new BearerStrategy({}, Auth.verifyToken));

	loginStrategies = await loadLoginStrategies();
	loginStrategies = loginStrategies || [];
	loginStrategies.forEach((strategy) => {
		registerStrategyAuthRoute(router, strategy);
		registerStrategyCallbackRoute(router, strategy);
	});

	registerBaseAuthRoutes(router);
};

passport.serializeUser((user, done) => {
	done(null, user.uid);
});

passport.deserializeUser((uid, done) => {
	done(null, {
		uid: uid,
	});
});
