const assert = require('assert');
const helpers = require('../../src/controllers/helpers');

describe('helpers.formatApiResponse', function () {
	it('responds to HEAD with status', async function () {
		let sentStatus = null;
		const res = {
			req: { method: 'HEAD' },
			sendStatus(code) { sentStatus = code; return 'sent'; },
		};

		await helpers.formatApiResponse(200, res, null);
		assert.strictEqual(sentStatus, 200);
	});

	it('sends success 200 JSON with body', async function () {
		let setCalled = false;
		let statusCode = null;
		let sentBody = null;

		const res = {
			req: { method: 'GET', loggedIn: true },
			set() { setCalled = true; },
			status(code) { statusCode = code; return { json(obj) { sentBody = obj; } }; },
		};

		await helpers.formatApiResponse(200, res, { foo: 'bar' });
		assert.strictEqual(setCalled, true);
		assert.strictEqual(statusCode, 200);
		assert.deepStrictEqual(sentBody.response, { foo: 'bar' });
	});

	it('maps error message to params and status for required-parameters', async function () {
		const payload = '[[error:required-parameters-missing, param1 param2 ]]';
		let statusCode = null;
		let sentBody = null;
		const res = {
			req: { method: 'GET', loggedIn: false, query: { lang: 'en' } },
			set() {},
			status(code) { statusCode = code; return { json(obj) { sentBody = obj; } }; },
		};

		await helpers.formatApiResponse(400, res, payload);
		assert.strictEqual(typeof statusCode, 'number');
		assert.ok(sentBody && sentBody.response);
		assert.deepStrictEqual(sentBody.response.params, ['param1', 'param2']);
	});
});
