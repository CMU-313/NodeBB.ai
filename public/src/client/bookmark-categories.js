'use strict';

define('bookmark-categories', ['api', 'alerts', 'bootbox'], function (api, alerts, bootbox) {
	const bookmarkCategories = {};

	bookmarkCategories.init = function () {
		$('body').on('click', '[component="post/bookmark/categorize"]', handleCategorizeClick);
	};

	function handleCategorizeClick(e) {
		e.preventDefault();
		const pid = $(this).data('pid');
		showBookmarkCategoriesModal(pid);
	}

	async function showBookmarkCategoriesModal(pid) {
		try {
			const categories = await api.get('/posts/bookmark-categories');
			const modal = await createModalHtml(categories, pid);
			bootbox.dialog({
				title: '[[topic:bookmark-categories]]',
				message: modal,
				size: 'large',
				buttons: {
					create: {
						label: '[[topic:bookmark-create-category]]',
						className: 'btn-primary',
						callback: () => {
							bootbox.prompt({
								title: '[[topic:bookmark-create-category-title]]',
								callback: async (name) => {
									if (!name) {
										return;
									}
									try {
										await api.post('/posts/bookmark-categories', { name });
										alerts.success('[[topic:bookmark-category-created]]');
										showBookmarkCategoriesModal(pid);
									} catch (err) {
										alerts.error(err);
									}
								},
							});
							return false;
						},
					},
					close: {
						label: '[[global:close]]',
						className: 'btn-link',
					},
				},
			});
		} catch (err) {
			alerts.error(err);
		}
	}

	async function createModalHtml(categories, pid) {
		const html = $('<div>');
		const list = $('<div class="list-group">').appendTo(html);

		if (!categories.length) {
			list.append($('<p>').text('[[topic:bookmark-no-categories]]'));
		} else {
			categories.forEach((category) => {
				const item = $('<div class="list-group-item d-flex justify-content-between align-items-center">');
				item.append($('<span>').text(category.name));
				const btnGroup = $('<div class="btn-group">').appendTo(item);

				const addBtn = $('<button class="btn btn-sm btn-primary">')
					.html('<i class="fa fa-plus"></i>')
					.on('click', async () => {
						try {
							await api.put(`/posts/${pid}/bookmark-categories/${category.categoryId}`);
							alerts.success('[[topic:bookmark-added-to-category]]');
						} catch (err) {
							alerts.error(err);
						}
					});

				const removeBtn = $('<button class="btn btn-sm btn-danger">')
					.html('<i class="fa fa-times"></i>')
					.on('click', async () => {
						try {
							await api.delete(`/posts/${pid}/bookmark-categories/${category.categoryId}`);
							alerts.success('[[topic:bookmark-removed-from-category]]');
						} catch (err) {
							alerts.error(err);
						}
					});

				btnGroup.append(addBtn, removeBtn);
				list.append(item);
			});
		}

		return html;
	}

	return bookmarkCategories;
});