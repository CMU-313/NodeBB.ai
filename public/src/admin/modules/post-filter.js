 'use strict';

define('admin/modules/post-filter', ['benchpress', 'bootbox', 'alerts'], (benchpress, bootbox, alerts) => {
	const PF = {};

	PF.init = () => {
		// inject a button into the admin header area if present
		const container = document.querySelector('.acp-page-main-header .d-flex') || document.querySelector('.acp-page-main-header .d-flex');
		if (!container) return;

		if (document.getElementById('admin-post-filter-btn')) return;

		const btn = document.createElement('button');
		btn.id = 'admin-post-filter-btn';
		btn.className = 'btn btn-outline-secondary btn-sm';
		btn.innerHTML = '<i class="fa fa-filter"></i> [[admin/filter:filter-posts]]';
		btn.addEventListener('click', PF.showModal);
		container.prepend(btn);
	};

	PF.showModal = () => {
		benchpress.render('partials/admin-post-filter', {}).then((html) => {
			bootbox.dialog({
				size: 'large',
				title: '[[admin/filter:filter-posts-by-date]]',
				message: html,
				buttons: {
					fetch: {
						label: '[[admin/filter:fetch-posts]]',
						className: 'btn-primary',
						callback: function () {
							PF.fetchByDate();
							return false; // keep dialog open until fetch completes
						},
					},
					cancel: {
						label: '[[modules:bootbox.cancel]]',
						className: 'btn-secondary',
					},
				},
			});
		});
	};

	PF.fetchByDate = () => {
		const start = document.querySelector('#admin-post-filter-start').value;
		const end = document.querySelector('#admin-post-filter-end').value;
		if (!start && !end) {
			alerts.alert('[[admin/filter:select-at-least-one-date]]');
			return;
		}

		let qs = '?';
		if (start) qs += `start=${encodeURIComponent(start)}`;
		if (end) qs += `${start ? '&' : ''}end=${encodeURIComponent(end)}`;

		fetch(`${config.relative_path}/api/admin/posts${qs}`, { credentials: 'include' }).then((res) => {
			if (!res.ok) {
				res.text().then(t => alerts.error(t || 'Error fetching posts'));
				return;
			}
			res.json().then((payload) => {
				// simple quality check: ensure array
				if (!Array.isArray(payload.posts)) {
					alerts.error('[[admin/filter:unexpected-response-format]]');
					return;
				}
				// show a small summary
				const count = payload.posts.length;
				alerts.success(`${count} posts found`);
				// Close any open bootbox
				if (window.bootbox && bootbox.hideAll) {
					bootbox.hideAll();
				}
				// For now, just log payload to console for QA
				console.info('Filtered posts payload:', payload);
			});
		}).catch((err) => alerts.error(err.message || err));
	};

	return PF;
});
