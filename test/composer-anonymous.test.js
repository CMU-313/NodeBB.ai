const assert = require('assert');
const helpers = require('./helpers');
const request = require('request-promise-native');
const nconf = require('nconf');

describe('Anonymous Checkbox in Composer', () => {
	let csrf_token;
	let jar;

	before(async () => {
		const login = await helpers.loginUser('foo', 'barbar');
		jar = login.jar;
		csrf_token = login.csrf_token;
	});

	it('should send anonymous parameter when checkbox is selected', async () => {
		const response = await request.post(`${nconf.get('url')}/compose`, {
			jar,
			form: {
				_csrf: csrf_token,
				content: 'Test anonymous post',
				anonymous: true,
			},
			resolveWithFullResponse: true,
		});

		assert.equal(response.statusCode, 200);
		assert(response.body.includes('anonymous: true'));
	});

	it('should not send anonymous parameter when checkbox is not selected', async () => {
		const response = await request.post(`${nconf.get('url')}/compose`, {
			jar,
			form: {
				_csrf: csrf_token,
				content: 'Test regular post',
			},
			resolveWithFullResponse: true,
		});

		assert.equal(response.statusCode, 200);
		assert(!response.body.includes('anonymous: true'));
	});
});