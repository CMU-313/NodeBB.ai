'use strict';'use strict';



const db = require('../database');const db = require('../database');

const utils = require('../utils');const utils = require('../utils');

const plugins = require('../plugins');const plugins = require('../plugins');



module.exports = function (Posts) {module.exports = function (Posts) {

	// Create a new bookmark category    // Create a new bookmark category

	Posts.createBookmarkCategory = async function (uid, data) {    Posts.createBookmarkCategory = async function (uid, data) {

		if (parseInt(uid, 10) <= 0) {        if (parseInt(uid, 10) <= 0) {

			throw new Error('[[error:not-logged-in]]');            throw new Error('[[error:not-logged-in]]');

		}        }

		        

		const categoryId = utils.generateUUID();        const categoryId = utils.generateUUID();

		const timestamp = Date.now();        const timestamp = Date.now();

		        

		await db.setObject(`bookmark:category:${categoryId}`, {        await db.setObject(`bookmark:category:${categoryId}`, {

			name: data.name,            name: data.name,

			description: data.description || '',            description: data.description || '',

			uid: uid,            uid: uid,

			created: timestamp,            created: timestamp,

		});        });

		        

		await db.sortedSetAdd(`uid:${uid}:bookmark:categories`, timestamp, categoryId);        await db.sortedSetAdd(`uid:${uid}:bookmark:categories`, timestamp, categoryId);

		        

		return {        return {

			categoryId,            categoryId,

			name: data.name,            name: data.name,

			description: data.description || '',            description: data.description || '',

			created: timestamp,            created: timestamp,

		};        };

	};    };



	// Get user's bookmark categories    // Get user's bookmark categories

	Posts.getBookmarkCategories = async function (uid) {    Posts.getBookmarkCategories = async function (uid) {

		if (parseInt(uid, 10) <= 0) {        if (parseInt(uid, 10) <= 0) {

			return [];            return [];

		}        }



		const categoryIds = await db.getSortedSetRevRange(`uid:${uid}:bookmark:categories`, 0, -1);        const categoryIds = await db.getSortedSetRevRange(`uid:${uid}:bookmark:categories`, 0, -1);

		if (!categoryIds.length) {        if (!categoryIds.length) {

			return [];            return [];

		}        }



		const categoryData = await db.getObjects(categoryIds.map(id => `bookmark:category:${id}`));        const categoryData = await db.getObjects(categoryIds.map(id => `bookmark:category:${id}`));

		return categoryData.map((category, index) => ({        return categoryData.map((category, index) => ({

			...category,            ...category,

			categoryId: categoryIds[index],            categoryId: categoryIds[index],

		}));        }));

	};    };



	// Update a bookmark category    // Update a bookmark category

	Posts.updateBookmarkCategory = async function (uid, categoryId, data) {    Posts.updateBookmarkCategory = async function (uid, categoryId, data) {

		const categoryData = await db.getObject(`bookmark:category:${categoryId}`);        const categoryData = await db.getObject(`bookmark:category:${categoryId}`);

		if (!categoryData) {        if (!categoryData) {

			throw new Error('[[error:invalid-category]]');            throw new Error('[[error:invalid-category]]');

		}        }

		if (parseInt(categoryData.uid, 10) !== parseInt(uid, 10)) {        if (parseInt(categoryData.uid, 10) !== parseInt(uid, 10)) {

			throw new Error('[[error:no-privileges]]');            throw new Error('[[error:no-privileges]]');

		}        }



		const updatedData = {        const updatedData = {

			name: data.name,            name: data.name,

			description: data.description || categoryData.description,            description: data.description || categoryData.description,

		};        };



		await db.setObject(`bookmark:category:${categoryId}`, updatedData);        await db.setObject(`bookmark:category:${categoryId}`, updatedData);

		return { ...categoryData, ...updatedData };        return { ...categoryData, ...updatedData };

	};    };



	// Delete a bookmark category    // Delete a bookmark category

	Posts.deleteBookmarkCategory = async function (uid, categoryId) {    Posts.deleteBookmarkCategory = async function (uid, categoryId) {

		const categoryData = await db.getObject(`bookmark:category:${categoryId}`);        const categoryData = await db.getObject(`bookmark:category:${categoryId}`);

		if (!categoryData) {        if (!categoryData) {

			throw new Error('[[error:invalid-category]]');            throw new Error('[[error:invalid-category]]');

		}        }

		if (parseInt(categoryData.uid, 10) !== parseInt(uid, 10)) {        if (parseInt(categoryData.uid, 10) !== parseInt(uid, 10)) {

			throw new Error('[[error:no-privileges]]');            throw new Error('[[error:no-privileges]]');

		}        }



		await Promise.all([        await Promise.all([

			db.delete(`bookmark:category:${categoryId}`),            db.delete(`bookmark:category:${categoryId}`),

			db.sortedSetRemove(`uid:${uid}:bookmark:categories`, categoryId),            db.sortedSetRemove(`uid:${uid}:bookmark:categories`, categoryId),

			db.delete(`uid:${uid}:bookmarks:category:${categoryId}`),            db.delete(`uid:${uid}:bookmarks:category:${categoryId}`),

		]);        ]);

	};    };



	// Add a bookmark to a category    // Add a bookmark to a category

	Posts.addBookmarkToCategory = async function (uid, pid, categoryId) {    Posts.addBookmarkToCategory = async function (uid, pid, categoryId) {

		const [hasBookmarked, categoryExists] = await Promise.all([        const [hasBookmarked, categoryExists] = await Promise.all([

			Posts.hasBookmarked(pid, uid),            Posts.hasBookmarked(pid, uid),

			db.exists(`bookmark:category:${categoryId}`),            db.exists(`bookmark:category:${categoryId}`),

		]);        ]);



		if (!hasBookmarked) {        if (!hasBookmarked) {

			throw new Error('[[error:not-bookmarked]]');            throw new Error('[[error:not-bookmarked]]');

		}        }

		if (!categoryExists) {        if (!categoryExists) {

			throw new Error('[[error:invalid-category]]');            throw new Error('[[error:invalid-category]]');

		}        }



		await db.sortedSetAdd(`uid:${uid}:bookmarks:category:${categoryId}`, Date.now(), pid);        await db.sortedSetAdd(`uid:${uid}:bookmarks:category:${categoryId}`, Date.now(), pid);

		await plugins.hooks.fire('action:post.bookmark.categorize', { pid, uid, categoryId });        await plugins.hooks.fire('action:post.bookmark.categorize', { pid, uid, categoryId });

	};    };



	// Remove a bookmark from a category    // Remove a bookmark from a category

	Posts.removeBookmarkFromCategory = async function (uid, pid, categoryId) {    Posts.removeBookmarkFromCategory = async function (uid, pid, categoryId) {

		await db.sortedSetRemove(`uid:${uid}:bookmarks:category:${categoryId}`, pid);        await db.sortedSetRemove(`uid:${uid}:bookmarks:category:${categoryId}`, pid);

	};    };



	// Get bookmarks in a category    // Get bookmarks in a category

	Posts.getBookmarksInCategory = async function (uid, categoryId, start, limit) {    Posts.getBookmarksInCategory = async function (uid, categoryId, start, limit) {

		if (parseInt(uid, 10) <= 0) {        if (parseInt(uid, 10) <= 0) {

			return [];            return [];

		}        }



		const pids = await db.getSortedSetRevRange(`uid:${uid}:bookmarks:category:${categoryId}`, start, limit);        const pids = await db.getSortedSetRevRange(`uid:${uid}:bookmarks:category:${categoryId}`, start, limit);

		if (!pids.length) {        if (!pids.length) {

			return [];            return [];

		}        }



		const postData = await Posts.getPostSummaryByPids(pids, uid, { stripTags: false });        const postData = await Posts.getPostSummaryByPids(pids, uid, { stripTags: false });

		return postData;        return postData;

	};    };

};};