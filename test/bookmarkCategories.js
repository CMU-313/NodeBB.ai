'use strict';

const assert = require('assert');
const util = require('util');

const db = require('../src/database');
const topics = require('../src/topics');
const posts = require('../src/posts');
const categories = require('../src/categories');
const user = require('../src/user');
const meta = require('../src/meta');

describe('Bookmark Categories', () => {
	let uid;
	let cid;
	let tid;
	let pid;

	before(async () => {
		// Create a test user
		uid = await user.create({ username: 'testuser', email: 'test@example.com' });

		// Create a test category
		const categoryData = {
			name: 'Test Category',
			description: 'Test category created by testing script',
		};
		const testCategory = await categories.create(categoryData);
		cid = testCategory.cid;

		// Create a test topic with a post
		const topicData = {
			uid,
			cid,
			title: 'Test Topic',
			content: 'Test topic created by testing script',
		};
		const testTopic = await topics.post(topicData);
		tid = testTopic.topicData.tid;
		pid = testTopic.postData.pid;
	});

	describe('Bookmark Category Creation', () => {
		it('should create a bookmark category', async () => {
			const categoryData = {
				name: 'Important Posts',
				description: 'Posts that need follow-up',
			};
			const result = await posts.createBookmarkCategory(uid, categoryData);
			assert(result.categoryId);
			assert.strictEqual(result.name, categoryData.name);
			assert.strictEqual(result.description, categoryData.description);
		});

		it('should error when creating bookmark category with no name', async () => {
			const categoryData = {};
			try {
				await posts.createBookmarkCategory(uid, categoryData);
				assert(false);
			} catch (err) {
				assert.strictEqual(err.message, '[[error:invalid-data]]');
			}
		});

		it('should error when creating bookmark category with invalid uid', async () => {
			try {
				await posts.createBookmarkCategory(0, { name: 'test' });
				assert(false);
			} catch (err) {
				assert.strictEqual(err.message, '[[error:not-logged-in]]');
			}
		});
	});

	describe('Bookmark Category Management', () => {
		let categoryId;

		before(async () => {
			const result = await posts.createBookmarkCategory(uid, {
				name: 'Test Category',
			});
			categoryId = result.categoryId;
		});

		it('should get bookmark categories', async () => {
			const categories = await posts.getBookmarkCategories(uid);
			assert(Array.isArray(categories));
			assert(categories.length > 0);
			assert(categories.find(c => c.categoryId === categoryId));
		});

		it('should update bookmark category', async () => {
			const updatedData = {
				name: 'Updated Category',
				description: 'Updated description',
			};
			const result = await posts.updateBookmarkCategory(uid, categoryId, updatedData);
			assert.strictEqual(result.name, updatedData.name);
			assert.strictEqual(result.description, updatedData.description);
		});

		it('should error when updating non-existent category', async () => {
			try {
				await posts.updateBookmarkCategory(uid, 'invalid-id', { name: 'test' });
				assert(false);
			} catch (err) {
				assert.strictEqual(err.message, '[[error:invalid-category]]');
			}
		});

		it('should delete bookmark category', async () => {
			await posts.deleteBookmarkCategory(uid, categoryId);
			const categories = await posts.getBookmarkCategories(uid);
			assert(!categories.find(c => c.categoryId === categoryId));
		});
	});

	describe('Bookmark Category Assignment', () => {
		let categoryId;

		before(async () => {
			// Create category and bookmark post
			const result = await posts.createBookmarkCategory(uid, {
				name: 'Test Category',
			});
			categoryId = result.categoryId;
			await posts.bookmark(pid, uid);
		});

		it('should add bookmark to category', async () => {
			await posts.addBookmarkToCategory(uid, pid, categoryId);
			const bookmarks = await posts.getBookmarksInCategory(uid, categoryId, 0, -1);
			assert(Array.isArray(bookmarks));
			assert(bookmarks.find(p => p.pid === pid));
		});

		it('should error when adding non-bookmarked post to category', async () => {
			await posts.unbookmark(pid, uid);
			try {
				await posts.addBookmarkToCategory(uid, pid, categoryId);
				assert(false);
			} catch (err) {
				assert.strictEqual(err.message, '[[error:not-bookmarked]]');
			}
		});

		it('should remove bookmark from category', async () => {
			await posts.bookmark(pid, uid);
			await posts.addBookmarkToCategory(uid, pid, categoryId);
			await posts.removeBookmarkFromCategory(uid, pid, categoryId);
			const bookmarks = await posts.getBookmarksInCategory(uid, categoryId, 0, -1);
			assert(!bookmarks.find(p => p.pid === pid));
		});
	});

	after(async () => {
		await user.delete(uid);
		await categories.purge(cid);
	});
});