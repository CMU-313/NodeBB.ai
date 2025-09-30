'use strict';

const categories = require('../../categories');
const helpers = require('../helpers');
const pagination = require('../../pagination');

const leaderboardController = module.exports;

leaderboardController.get = async function (req, res) {
	const cid = req.params.category_id || req.query.cid;
	const itemsPerPage = 50;
	const page = parseInt(req.query.page, 10) || 1;
	const start = (page - 1) * itemsPerPage;
	const stop = start + itemsPerPage - 1;

	let leaderboardData;
	let categoryData = null;
	let selectedData = null;
	let pageTitle = '[[admin/manage/leaderboard:global-leaderboard]]';

	if (cid && cid !== 'global') {
		// Category-specific leaderboard
		[leaderboardData, categoryData, selectedData] = await Promise.all([
			categories.getLeaderboard(cid, start, stop),
			categories.getCategoryData(cid),
			helpers.getSelectedCategory(cid),
		]);
		pageTitle = categoryData ? categoryData.name : 'Category Leaderboard';
	} else {
		// Global leaderboard
		[leaderboardData, selectedData] = await Promise.all([
			categories.getGlobalLeaderboard(start, stop),
			helpers.getSelectedCategory(0),
		]);
	}

	// Calculate total count for pagination
	const totalUsers = leaderboardData.length > 0 ? 
		(leaderboardData[leaderboardData.length - 1].rank + itemsPerPage) : 0;
	const pageCount = Math.max(1, Math.ceil(totalUsers / itemsPerPage));

	res.render('admin/manage/leaderboard', {
		leaderboard: leaderboardData,
		category: categoryData,
		selectedCategory: selectedData ? selectedData.selectedCategory : null,
		categoryItems: selectedData ? selectedData.categoryItems : [],
		selectCategoryLabel: '[[admin/manage/categories:jump-to]]',
		pageTitle: pageTitle,
		pagination: pagination.create(page, pageCount, req.query),
		breadcrumbs: helpers.buildBreadcrumbs([
			{ text: '[[admin/manage/categories:categories]]', url: '/admin/manage/categories' },
			{ text: pageTitle },
		]),
	});
};
