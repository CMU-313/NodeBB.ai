'use strict';

const assert = require('assert');
const topics = require('../src/topics');

describe('topics resolve tools', function () {
	it('should expose resolve/unresolve functions', async () => {
		assert.strictEqual(typeof topics.tools.resolve, 'function');
		assert.strictEqual(typeof topics.tools.unresolve, 'function');
	});

	it('resolve with invalid tid should throw', async () => {
		let threw = false;
		try {
			await topics.tools.resolve(-1, 'system');
		} catch (err) {
			threw = true;
		}
		assert.strictEqual(threw, true);
	});
});
