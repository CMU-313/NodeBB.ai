'use strict';

const assert = require('assert');
const db = require('./mocks/databasemock');

const topics = require('../src/topics');
const posts = require('../src/posts');
const categories = require('../src/categories');
const user = require('../src/user');

describe('Anonymous Posts', () => {
	let categoryObj;
	let adminUid;

	before(async () => {
		adminUid = await user.create({ username: 'admin', password: '123456' });
		categoryObj = await categories.create({
			name: 'Test Category',
			description: 'Test category for anonymous posts',
		});
	});

	it('should create an anonymous topic post', async () => {
		const result = await topics.post({
			uid: adminUid,
			cid: categoryObj.cid,
			title: 'Anonymous Topic',
			content: 'This is an anonymous topic post',
			anonymous: true,
		});

		assert.ok(result.postData);
		assert.ok(result.topicData);
		assert.strictEqual(result.postData.anonymous, 1);
	});

	it('should create an anonymous reply', async () => {
		const topicResult = await topics.post({
			uid: adminUid,
			cid: categoryObj.cid,
			title: 'Test Topic for Anonymous Reply',
			content: 'Main post content',
		});

		const replyResult = await topics.reply({
			uid: adminUid,
			tid: topicResult.topicData.tid,
			content: 'This is an anonymous reply',
			anonymous: true,
		});

		assert.ok(replyResult);
		assert.strictEqual(replyResult.anonymous, 1);
	});

	it('should display "Anonymous" as the username for anonymous posts', async () => {
		const topicResult = await topics.post({
			uid: adminUid,
			cid: categoryObj.cid,
			title: 'Anonymous Display Test',
			content: 'Test anonymous user display',
			anonymous: true,
		});

		const postSummary = await posts.getPostSummaryByPids([topicResult.postData.pid], adminUid, {});
		assert.ok(postSummary[0]);
		assert.strictEqual(postSummary[0].user.username, 'Anonymous');
		assert.strictEqual(postSummary[0].user.displayname, 'Anonymous');
		assert.strictEqual(postSummary[0].user.uid, 0);
	});

	it('should not display "Anonymous" for non-anonymous posts', async () => {
		const topicResult = await topics.post({
			uid: adminUid,
			cid: categoryObj.cid,
			title: 'Non-Anonymous Test',
			content: 'Test non-anonymous user display',
			anonymous: false,
		});

		const postSummary = await posts.getPostSummaryByPids([topicResult.postData.pid], adminUid, {});
		assert.ok(postSummary[0]);
		assert.notStrictEqual(postSummary[0].user.username, 'Anonymous');
		assert.strictEqual(postSummary[0].user.username, 'admin');
	});
});
