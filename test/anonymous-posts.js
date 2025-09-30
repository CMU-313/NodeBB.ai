'use strict';

const assert = require('assert');
const db = require('./mocks/databasemock');
const topics = require('../src/topics');
const posts = require('../src/posts');
const categories = require('../src/categories');
const user = require('../src/user');

describe('Anonymous Posts', () => {
	let testUid;
	let testCid;
	let topicData;

	before(async () => {
		testUid = await user.create({ username: 'anonymoustester' });
		const categoryObj = await categories.create({
			name: 'Test Anonymous Category',
			description: 'Category for testing anonymous posts',
		});
		testCid = categoryObj.cid;
	});

	describe('anonymous topic creation', () => {
		it('should create a topic with anonymous flag', async () => {
			const result = await topics.post({
				uid: testUid,
				cid: testCid,
				title: 'Anonymous Topic',
				content: 'This is an anonymous topic',
				anonymous: 1,
			});
			
			topicData = result.topicData;
			assert(result.postData);
			assert.equal(result.postData.anonymous, 1);
			
			// Check that the post is marked as anonymous in the database
			const postFields = await posts.getPostFields(result.postData.pid, ['anonymous', 'uid']);
			assert.equal(postFields.anonymous, 1);
			assert.equal(postFields.uid, testUid);
		});

		it('should create a topic without anonymous flag by default', async () => {
			const result = await topics.post({
				uid: testUid,
				cid: testCid,
				title: 'Normal Topic',
				content: 'This is a normal topic',
			});
			
			assert(result.postData);
			assert.equal(result.postData.anonymous, 0);
			
			// Check that the post is not marked as anonymous in the database
			const postFields = await posts.getPostFields(result.postData.pid, ['anonymous', 'uid']);
			assert.equal(postFields.anonymous, 0);
			assert.equal(postFields.uid, testUid);
		});
	});

	describe('anonymous replies', () => {
		it('should create an anonymous reply', async () => {
			const replyData = await topics.reply({
				uid: testUid,
				tid: topicData.tid,
				content: 'This is an anonymous reply',
				anonymous: 1,
			});
			
			assert(replyData);
			assert.equal(replyData.anonymous, 1);
			
			// Check that the reply is marked as anonymous in the database
			const postFields = await posts.getPostFields(replyData.pid, ['anonymous', 'uid']);
			assert.equal(postFields.anonymous, 1);
			assert.equal(postFields.uid, testUid);
		});

		it('should create a normal reply without anonymous flag', async () => {
			const replyData = await topics.reply({
				uid: testUid,
				tid: topicData.tid,
				content: 'This is a normal reply',
			});
			
			assert(replyData);
			assert.equal(replyData.anonymous, 0);
			
			// Check that the reply is not marked as anonymous
			const postFields = await posts.getPostFields(replyData.pid, ['anonymous', 'uid']);
			assert.equal(postFields.anonymous, 0);
			assert.equal(postFields.uid, testUid);
		});
	});

	describe('anonymous post display', () => {
		it('should return anonymous user info for anonymous posts', async () => {
			// Create an anonymous post
			const result = await topics.reply({
				uid: testUid,
				tid: topicData.tid,
				content: 'Another anonymous reply',
				anonymous: 1,
			});

			// Get post summary which should handle anonymous display
			const summary = await posts.getPostSummaryByPids([result.pid], testUid, { stripTags: false });
			
			assert(summary[0]);
			assert.equal(summary[0].anonymous, 1);
			assert.equal(summary[0].user.uid, 0);
			assert.equal(summary[0].user.username, '[[global:anonymous]]');
			assert.equal(summary[0].user.displayname, '[[global:anonymous]]');
		});

		it('should return normal user info for non-anonymous posts', async () => {
			// Create a normal post
			const result = await topics.reply({
				uid: testUid,
				tid: topicData.tid,
				content: 'Normal reply',
				anonymous: 0,
			});

			// Get post summary 
			const summary = await posts.getPostSummaryByPids([result.pid], testUid, { stripTags: false });
			
			assert(summary[0]);
			assert.equal(summary[0].anonymous, 0);
			assert.equal(summary[0].user.uid, testUid);
			assert.notEqual(summary[0].user.username, '[[global:anonymous]]');
		});
	});

	describe('topic display with anonymous posts', () => {
		it('should handle anonymous posts in topic post display', async () => {
			// Get topic with posts
			const topicWithPosts = await topics.getTopicWithPosts(topicData, `tid:${topicData.tid}:posts`, testUid, 0, 19, false);
			
			assert(topicWithPosts);
			assert(Array.isArray(topicWithPosts.posts));
			
			// Find anonymous posts and verify they display correctly
			const anonymousPosts = topicWithPosts.posts.filter(post => post.anonymous);
			assert(anonymousPosts.length > 0, 'Should have at least one anonymous post');
			
			anonymousPosts.forEach(post => {
				assert.equal(post.user.uid, 0);
				assert.equal(post.user.username, '[[global:anonymous]]');
				assert.equal(post.user.displayname, '[[global:anonymous]]');
			});
		});
	});
});