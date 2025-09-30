'use strict';

const nconf = require('nconf');
const fs = require('fs');
const path = require('path');
const winston = require('winston');

const request = require('../../src/request');

const helpers = module.exports;

helpers.getCsrfToken = async (jar) => {
	const { body } = await request.get(`${nconf.get('url')}/api/config`, {
		jar,
	});
	return body.csrf_token;
};

helpers.request = async function (method, uri, options = {}) {
	const ignoreMethods = ['GET', 'HEAD', 'OPTIONS'];
	const lowercaseMethod = String(method).toLowerCase();
	let csrf_token;
	if (!ignoreMethods.some((m) => m.toLowerCase() === lowercaseMethod)) {
		csrf_token = await helpers.getCsrfToken(options.jar);
	}

	options.headers = options.headers || {};
	if (csrf_token) {
		options.headers['x-csrf-token'] = csrf_token;
	}
	return await request[lowercaseMethod](`${nconf.get('url')}${uri}`, options);
};

helpers.loginUser = async (username, password, payload = {}) => {
	const jar = request.jar();
	const data = { username, password, ...payload };

	const csrf_token = await helpers.getCsrfToken(jar);
	const { response, body } = await request.post(`${nconf.get('url')}/login`, {
		body: data,
		jar,
		headers: {
			'x-csrf-token': csrf_token,
		},
	});

	return { jar, response, body, csrf_token };
};

helpers.logoutUser = async function (jar) {
	const csrf_token = await helpers.getCsrfToken(jar);
	const { response, body } = await request.post(`${nconf.get('url')}/logout`, {
		body: {},
		jar,
		headers: {
			'x-csrf-token': csrf_token,
		},
	});
	return { response, body };
};

helpers.connectSocketIO = function (res, csrf_token) {
	const io = require('socket.io-client');
	const cookie = res.headers['set-cookie'];
	const socket = io(nconf.get('base_url'), {
		path: `${nconf.get('relative_path')}/socket.io`,
		extraHeaders: {
			Origin: nconf.get('url'),
			Cookie: cookie,
		},
		query: {
			_csrf: csrf_token,
		},
	});
	return new Promise((resolve, reject) => {
		let error;
		socket.on('connect', () => {
			if (error) {
				return;
			}
			resolve(socket);
		});

		socket.on('error', (err) => {
			error = err;
			// keep console for test debug visibility
			console.log('socket.io error', err.stack);
			reject(err);
		});
	});
};

/**
 * Upload a file using a single options object to avoid many parameters.
 *
 * Preferred usage:
 *   await helpers.uploadFile({
 *     endpoint: 'http://host/api/upload',
 *     filePath: '/tmp/image.png',
 *     data: { params: '{"foo":"bar"}' }, // optional
 *     jar,
 *     csrfToken
 *   });
 *
 * Backward-compatible usage (deprecated):
 *   await helpers.uploadFile(uploadEndPoint, filePath, data, jar, csrf_token)
 *
 * @param {object|string} optsOrEndpoint - Options object or legacy endpoint string
 * @param {string} [legacyFilePath]
 * @param {object} [legacyData]
 * @param {import('../../src/request').CookieJar} [legacyJar]
 * @param {string} [legacyCsrf]
 * @returns {Promise<{body:any, 
 * response:{status:number,statusCode:number,statusText:string,headers:Record<string,string>}}>}
 */
helpers.uploadFile = async function uploadFile(optsOrEndpoint, legacyFilePath, legacyData, legacyJar, legacyCsrf) {
	const usingLegacySignature = typeof optsOrEndpoint === 'string';

	/** @type {{endpoint:string,filePath:string,data?:any,jar?:any,csrfToken?:string}} */
	const opts = usingLegacySignature ? {
		endpoint: optsOrEndpoint,
		filePath: legacyFilePath,
		data: legacyData,
		jar: legacyJar,
		csrfToken: legacyCsrf,
	} : optsOrEndpoint || {};

	if (usingLegacySignature) {
		// eslint-disable-next-line no-console
		console.warn('[helpers.uploadFile] DEPRECATED signature used. Please pass a single options object.');
	}

	const { endpoint, filePath, data, jar, csrfToken } = opts;

	if (!endpoint) {
		throw new Error('uploadFile: "endpoint" is required');
	}
	if (!filePath) {
		throw new Error('uploadFile: "filePath" is required');
	}

	const mime = require('mime');
	// FormData/Blob/fetch are provided by Node >=18 test runtime
	const form = new FormData();

	const file = await fs.promises.readFile(filePath);
	const blob = new Blob([file], { type: mime.getType(filePath) || 'application/octet-stream' });

	form.append('files', blob, path.basename(filePath));

	if (data && data.params) {
		form.append('params', data.params);
	}

	const headers = {
		'x-csrf-token': csrfToken,
	};

	// Add cookie header if a jar is provided (same behavior as before)
	if (jar && typeof jar.getCookieString === 'function') {
		headers.cookie = await jar.getCookieString(endpoint);
	}

	const response = await fetch(endpoint, {
		method: 'post',
		body: form,
		headers,
	});
	const body = await response.json();
	return {
		body,
		response: {
			status: response.status,
			statusCode: response.status,
			statusText: response.statusText,
			headers: Object.fromEntries(response.headers.entries()),
		},
	};
};

helpers.registerUser = async function (data) {
	const jar = request.jar();
	const csrf_token = await helpers.getCsrfToken(jar);

	if (!Object.prototype.hasOwnProperty.call(data, 'password-confirm')) {
		data['password-confirm'] = data.password;
	}

	const { response, body } = await request.post(`${nconf.get('url')}/register`, {
		body: data,
		jar,
		headers: {
			'x-csrf-token': csrf_token,
		},
	});
	return { jar, response, body };
};

// http://stackoverflow.com/a/14387791/583363
helpers.copyFile = function (source, target, callback) {
	let cbCalled = false;

	const rd = fs.createReadStream(source);
	rd.on('error', (err) => {
		done(err);
	});
	const wr = fs.createWriteStream(target);
	wr.on('error', (err) => {
		done(err);
	});
	wr.on('close', () => {
		done();
	});
	rd.pipe(wr);

	function done(err) {
		if (!cbCalled) {
			callback(err);
			cbCalled = true;
		}
	}
};

helpers.invite = async function (data, uid, jar, csrf_token) {
	return await request.post(`${nconf.get('url')}/api/v3/users/${uid}/invites`, {
		jar,
		body: data,
		headers: {
			'x-csrf-token': csrf_token,
		},
	});
};

helpers.createFolder = async function (pathValue, folderName, jar, csrf_token) {
	return await request.put(`${nconf.get('url')}/api/v3/files/folder`, {
		jar,
		body: {
			path: pathValue,
			folderName,
		},
		headers: {
			'x-csrf-token': csrf_token,
		},
	});
};

require('../../src/promisify')(helpers);
