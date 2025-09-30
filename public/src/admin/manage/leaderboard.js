'use strict';

define('admin/manage/leaderboard', [
	'categorySelector',
], function (categorySelector) {
	const Leaderboard = {};

	Leaderboard.init = function () {
		// Initialize category selector
		categorySelector.init($('[component="category-selector"]'), {
			onSelect: function (selectedCategory) {
				if (selectedCategory && selectedCategory.cid) {
					ajaxify.go('admin/manage/leaderboard/' + selectedCategory.cid);
				}
			},
			cacheList: false,
			showLinks: true,
			template: 'admin/partials/category/selector-dropdown-right',
		});
	};

	return Leaderboard;
});
