const assert = require('assert');
const posts = require('../../src/posts');
const db = require('../../src/database');

describe('Question Visibility', () => {
	let questionId;

	before(async () => {
		// Create a mock question
		questionId = await posts.create({
			title: 'Test Question',
			content: 'This is a test question.',
		});
	});

	after(async () => {
		// Clean up the mock question
		await db.delete(`question:${questionId}`);
	});

	it('should set visibility to public', async () => {
		await db.setQuestionVisibility(questionId, 'public');
		const visibility = await db.getQuestionVisibility(questionId);
		assert.strictEqual(visibility, 'public');
	});

	it('should set visibility to private', async () => {
		await db.setQuestionVisibility(questionId, 'private');
		const visibility = await db.getQuestionVisibility(questionId);
		assert.strictEqual(visibility, 'private');
	});

	it('should set visibility to specific', async () => {
		await db.setQuestionVisibility(questionId, 'specific');
		const visibility = await db.getQuestionVisibility(questionId);
		assert.strictEqual(visibility, 'specific');
	});
});