const assert = require('assert');
const helpers = require('../src/controllers/helpers');

(async function run() {
	// HEAD
	let sentStatus = null;
	const resHead = { req: { method: 'HEAD' }, sendStatus(code) { sentStatus = code; return 'sent'; } };
	await helpers.formatApiResponse(200, resHead, null);
	assert.strictEqual(sentStatus, 200);

	// success
	let setCalled = false;
	let statusCode = null;
	let sentBody = null;
	const resSuccess = {
		req: { method: 'GET', loggedIn: true, query: {} },
		set() { setCalled = true; },
		status(code) { statusCode = code; return { json(obj) { sentBody = obj; } }; },
	};
	await helpers.formatApiResponse(200, resSuccess, { foo: 'bar' });
	assert.strictEqual(setCalled, true);
	assert.strictEqual(statusCode, 200);
	assert.deepStrictEqual(sentBody.response, { foo: 'bar' });

	// required params
	const payload = '[[error:required-parameters-missing, param1 param2 ]]';
	let errStatus = null;
	let errBody = null;
	const resErr = { req: { method: 'GET', loggedIn: false, query: { lang: 'en' } }, set() {}, status(code) { errStatus = code; return { json(obj) { errBody = obj; } }; } };
	await helpers.formatApiResponse(400, resErr, payload);
	assert.ok(errBody && errBody.response);
	assert.deepStrictEqual(errBody.response.params, ['param1', 'param2']);

	console.log('ALL OK');
})().catch(err => { console.error(err); process.exit(1); });
