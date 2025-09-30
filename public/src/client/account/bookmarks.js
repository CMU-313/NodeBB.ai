'use strict';

define('forum/account/bookmarks', [
	'forum/account/header',
	'forum/account/posts',
	'api',
	'alerts',
], function (header, posts, api, alerts) {
	const Bookmarks = {};

	Bookmarks.init = function () {
		header.init();
		initCategoryFilter();

		$('[component="post/content"] img:not(.not-responsive)').addClass('img-fluid');
		posts.handleInfiniteScroll('account/bookmarks');
	};

	async function initCategoryFilter() {
		try {
			const categories = await api.get('/posts/bookmark-categories');
			const container = $('[component="bookmarks/category-filter"]');
			const select = $('<select class="form-control">').appendTo(container);

			select.append($('<option value="">[[topic:all-categories]]</option>'));
			categories.forEach((category) => {
				select.append($('<option>')
					.val(category.categoryId)
					.text(category.name));
			});

			select.on('change', () => {
				const categoryId = select.val();
				if (categoryId) {
					loadCategoryBookmarks(categoryId);
				} else {
					reloadAllBookmarks();
				}
			});
		} catch (err) {
			alerts.error(err);
		}
	}

	async function loadCategoryBookmarks(categoryId) {
		try {
			const bookmarks = await api.get(`/posts/bookmark-categories/${categoryId}`);
			const html = await posts.parseBookmarks(bookmarks);
			$('[component="posts"]').html(html);
		} catch (err) {
			alerts.error(err);
		}
	}

	function reloadAllBookmarks() {
		$('[component="posts"]').html('');
		posts.handleInfiniteScroll('account/bookmarks');
	}

	return Bookmarks;
});
