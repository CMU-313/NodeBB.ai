'use strict';


define('forum/categories', ['categorySelector', 'api', 'hooks'], function (categorySelector, api, hooks) {
	const categories = {};

	categories.init = function () {
		app.enterRoom('categories');

		categorySelector.init($('[component="category-selector"]'), {
			privilege: 'find',
			onSelect: function (category) {
				ajaxify.go('/category/' + category.cid);
			},
		});
	};

	categories.loadUnresolvedCounts = async function () {
		try {
			const counts = await api.get('/api/posts/unresolved/counts');
			Object.keys(counts).forEach((cid) => {
				const $category = $(`[data-cid="${cid}"]`);
				if ($category.length) {
					$category.find('[component="category/unresolved-count"]').text(counts[cid]);
				}
			});
		} catch (err) {
			console.error('Failed to load unresolved post counts:', err);
		}
	};

	hooks.on('action:ajaxify.end', function () {
		if (ajaxify.data.template.categories) {
			categories.loadUnresolvedCounts();
		}
	});

	return categories;
});
