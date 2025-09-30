const { expect } = require('chai');
const request = require('supertest');
const app = require('../../src/app'); // Adjust path to your app entry point

describe('GET /api/unanswered', function () {
	it('should return a list of unanswered posts', async function () {
		const res = await request(app)
			.get('/api/unanswered')
			.query({ start: 0, stop: 10 });

		expect(res.status).to.equal(200);
		expect(res.body).to.have.property('posts');
		expect(res.body.posts).to.be.an('array');

		// Check that all posts have 0 replies
		res.body.posts.forEach(post => {
			expect(post).to.have.property('replies', 0);
		});
	});

	it('should handle errors gracefully', async function () {
		const res = await request(app)
			.get('/api/unanswered')
			.query({ start: -1, stop: -10 }); // Invalid range

		expect(res.status).to.equal(500);
		expect(res.body).to.have.property('error');
	});
});