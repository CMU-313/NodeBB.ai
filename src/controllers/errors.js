'use strict';

const fs = require('fs');
const nconf = require('nconf');
const winston = require('winston');
const validator = require('validator');
const path = require('path');
const translator = require('../translator');
const middleware = require('../middleware');
const middlewareHelpers = require('../middleware/helpers');
const helpers = require('./helpers');

exports.handleURIErrors = async function handleURIErrors(err, req, res, next) {
	// Handle cases where malformed URIs are passed in
	if (err instanceof URIError) {
		const cleanPath = req.path.replace(new RegExp(`^${nconf.get('relative_path')}`), '');
		const tidMatch = cleanPath.match(/^\/topic\/(\d+)\//);
		const cidMatch = cleanPath.match(/^\/category\/(\d+)\//);

		if (tidMatch) {
			res.redirect(nconf.get('relative_path') + tidMatch[0]);
		} else if (cidMatch) {
			res.redirect(nconf.get('relative_path') + cidMatch[0]);
		} else {
			winston.warn(`[controller] Bad request: ${req.path}`);
			if (req.path.startsWith(`${nconf.get('relative_path')}/api`)) {
				res.status(400).json({
					error: '[[global:400.title]]',
				});
			} else {
				await middleware.buildHeaderAsync(req, res);
				res.status(400).render('400', { error: validator.escape(String(err.message)) });
			}
		}
	} else {
		next(err);
	}
};

// this needs to have four arguments or express treats it as `(req, res, next)`
// don't remove `next`!
exports.handleErrors = async function handleErrors(err, req, res) {
	// Extracted function to handle specific error cases
	function handleSpecificError(err, req, res) {
		const errorHandlers = {
			EBADCSRFTOKEN: () => {
				winston.error(`${req.method} ${req.originalUrl}\n${err.message}`);
				res.sendStatus(403);
			},
			'blacklisted-ip': () => {
				res.status(403).type('text/plain').send(err.message);
			},
		};

		if (errorHandlers[err.code]) {
			errorHandlers[err.code]();
			return true;
		}
		return false;
	}

	// Extracted function to handle not found errors
	function handleNotFoundError(req, res) {
		const controllers = require('.');
		controllers['404'].handle404(req, res);
	}

	// Extracted function to handle not built errors
	async function handleNotBuiltError(res) {
		let file = await fs.promises.readFile(path.join(__dirname, '../../public/500.html'), { encoding: 'utf-8' });
		file = file.replace('{message}', 'Failed to lookup view! Did you run `./nodebb build`?');
		res.type('text/html').send(file);
	}

	// Extracted function to handle default errors
	async function handleDefaultError(err, req, res) {
		if (res.headersSent) {
			return;
		}

		const status = parseInt(err.status, 10) || 500;
		const path = String(req.path || '');

		if (path.startsWith(`${nconf.get('relative_path')}/api/v3`)) {
			if (err.message.startsWith('[[')) {
				err.message = await translator.translate(err.message);
				return helpers.formatApiResponse(400, res, err);
			}
			return helpers.formatApiResponse(status, res, err);
		}

		winston.error(`${req.method} ${req.originalUrl}\n${err.stack}`);
		res.status(status);
		const data = {
			path: validator.escape(path),
			error: validator.escape(String(err.message)),
			bodyClass: middlewareHelpers.buildBodyClass(req, res),
		};

		if (res.locals.isAPI) {
			res.json(data);
		} else {
			await middleware.buildHeaderAsync(req, res);
			res.render('500', data);
		}
	}

	// Extracted function to handle unexpected errors
	function handleUnexpectedError(err, req, res) {
		winston.error(`${req.method} ${req.originalUrl}\n${err.stack}`);
		if (!res.headersSent) {
			res.status(500).send(err.message);
		}
	}

	try {
		// Handle specific error codes
		if (handleSpecificError(err, req, res)) {
			return;
		}

		// Handle specific error messages
		if (err.message) {
			if (err.message.startsWith('[[error:no-') && err.message !== '[[error:no-privileges]]') {
				handleNotFoundError(req, res);
				return;
			}

			if (err.message.startsWith('Failed to lookup view')) {
				await handleNotBuiltError(res);
				return;
			}
		}

		// Default error handling
		await handleDefaultError(err, req, res);
	} catch (_err) {
		handleUnexpectedError(_err, req, res);
	}
};
