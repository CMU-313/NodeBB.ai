'use strict';

const assert = require('assert');
const db = require('../src/database');
const posts = require('../src/posts');
const topics = require('../src/topics');
const user = require('../src/user');
const groups = require('../src/groups');
const categories = require('../src/categories');
const privileges = require('../src/privileges');
const apiPosts = require('../src/api/posts');
const utils = require('../src/utils');

describe('Post Endorsement', () => {
	let testUid;
	let instructorUid;
	let studentUid;
	let categoryData;
	let topicData;
	let postData;

	before(async () => {
		// Create test users
		testUid = await user.create({ username: 'testuser', email: 'test@example.com' });
		instructorUid = await user.create({ username: 'instructor', email: 'instructor@example.com' });
		studentUid = await user.create({ username: 'student', email: 'student@example.com' });

		// Make instructor user a global moderator (privileged)
		await groups.join('Global Moderators', instructorUid);

		// Create test category
		categoryData = await categories.create({
			name: 'Test Category',
			description: 'Test category for endorsement testing',
		});

		// Create test topic and post
		const result = await topics.post({
			uid: studentUid,
			title: 'Test Topic',
			content: 'This is a test topic',
			cid: categoryData.cid,
		});
		topicData = result.topicData;

		// Create a reply post to endorse
		const replyResult = await topics.reply({
			uid: studentUid,
			tid: topicData.tid,
			content: 'This is a test reply that can be endorsed',
		});
		postData = replyResult;
	});

	after(async () => {
		await db.flushdb();
	});

	describe('canEndorse', () => {
		it('should allow privileged users to endorse posts', async () => {
			const canEndorse = await posts.canEndorse(postData.pid, instructorUid);
			assert.strictEqual(canEndorse.flag, true);
		});

		it('should not allow non-privileged users to endorse posts', async () => {
			const canEndorse = await posts.canEndorse(postData.pid, studentUid);
			assert.strictEqual(canEndorse.flag, false);
			assert.strictEqual(canEndorse.message, '[[error:no-privileges]]');
		});

		it('should not allow users to endorse their own posts', async () => {
			const canEndorse = await posts.canEndorse(topicData.mainPid, instructorUid);
			// Create post by instructor first
			const instructorPostResult = await topics.reply({
				uid: instructorUid,
				tid: topicData.tid,
				content: 'Instructor post',
			});
			
			const canEndorseOwn = await posts.canEndorse(instructorPostResult.pid, instructorUid);
			assert.strictEqual(canEndorseOwn.flag, false);
			assert.strictEqual(canEndorseOwn.message, '[[error:cannot-endorse-own-post]]');
		});

		it('should not allow guests to endorse posts', async () => {
			const canEndorse = await posts.canEndorse(postData.pid, 0);
			assert.strictEqual(canEndorse.flag, false);
			assert.strictEqual(canEndorse.message, '[[error:not-logged-in]]');
		});
	});

	describe('endorse and unendorse', () => {
		it('should endorse a post', async () => {
			await posts.endorse(postData.pid, instructorUid);
			const postFields = await posts.getPostFields(postData.pid, ['endorsed', 'endorsedBy', 'endorsedTimestamp']);
			
			assert.strictEqual(parseInt(postFields.endorsed, 10), 1);
			assert.strictEqual(parseInt(postFields.endorsedBy, 10), parseInt(instructorUid, 10));
			assert(postFields.endorsedTimestamp > 0);
		});

		it('should check if post is endorsed', async () => {
			const hasEndorsed = await posts.hasEndorsed(postData.pid, instructorUid);
			assert.strictEqual(hasEndorsed, true);
		});

		it('should not allow endorsing already endorsed post', async () => {
			let error;
			try {
				await posts.endorse(postData.pid, instructorUid);
			} catch (err) {
				error = err;
			}
			assert.strictEqual(error.message, '[[error:already-endorsed]]');
		});

		it('should unendorse a post', async () => {
			await posts.unendorse(postData.pid, instructorUid);
			const postFields = await posts.getPostFields(postData.pid, ['endorsed', 'endorsedBy', 'endorsedTimestamp']);
			
			assert.strictEqual(parseInt(postFields.endorsed, 10), 0);
			assert.strictEqual(parseInt(postFields.endorsedBy, 10), 0);
			assert.strictEqual(parseInt(postFields.endorsedTimestamp, 10), 0);
		});

		it('should not allow unendorsing non-endorsed post', async () => {
			let error;
			try {
				await posts.unendorse(postData.pid, instructorUid);
			} catch (err) {
				error = err;
			}
			assert.strictEqual(error.message, '[[error:not-endorsed]]');
		});
	});

	describe('API endpoints', () => {
		it('should endorse via API', async () => {
			const result = await apiPosts.endorse({ uid: instructorUid }, { pid: postData.pid });
			assert(result);
			
			const hasEndorsed = await posts.hasEndorsed(postData.pid, instructorUid);
			assert.strictEqual(hasEndorsed, true);
		});

		it('should unendorse via API', async () => {
			const result = await apiPosts.unendorse({ uid: instructorUid }, { pid: postData.pid });
			assert(result);
			
			const hasEndorsed = await posts.hasEndorsed(postData.pid, instructorUid);
			assert.strictEqual(hasEndorsed, false);
		});

		it('should fail API endorsement without permissions', async () => {
			let error;
			try {
				await apiPosts.endorse({ uid: studentUid }, { pid: postData.pid });
			} catch (err) {
				error = err;
			}
			assert.strictEqual(error.message, '[[error:no-privileges]]');
		});
	});

	describe('data integrity', () => {
		it('should include endorsement data in post fields', async () => {
			// First endorse the post
			await posts.endorse(postData.pid, instructorUid);
			
			const post = await posts.getPostData(postData.pid);
			assert.strictEqual(parseInt(post.endorsed, 10), 1);
			assert.strictEqual(parseInt(post.endorsedBy, 10), parseInt(instructorUid, 10));
			assert(post.endorsedTimestamp > 0);
			assert(post.endorsedTimestampISO);
		});
	});
});