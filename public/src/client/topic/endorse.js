/*
	Client-side endorse handlers for topic posts.
	Mirrors the existing votes module's tooltip and toggle patterns.
*/

'use strict';


define('forum/topic/endorse', [
	'components', 'translator', 'api', 'hooks', 'bootbox', 'alerts', 'bootstrap',
], function (components, translator, api, hooks, bootbox, alerts, bootstrap) {
	const Endorse = {};
	let _showTooltip = {};

	Endorse.addEndorseHandler = function () {
		_showTooltip = {};
		components.get('topic').on('mouseenter', '[data-pid] [component="post/endorse-count"]', loadDataAndCreateTooltip);
		components.get('topic').on('mouseleave', '[data-pid] [component="post/endorse-count"]', destroyTooltip);
	};

	function destroyTooltip() {
		/*
			Client-side endorse handlers for topic posts.
			Mirrors the existing votes module's tooltip and toggle patterns.
		*/

		'use strict';


		define('forum/topic/endorse', [
			'components', 'translator', 'api', 'hooks', 'bootbox', 'alerts', 'bootstrap',
		], function (components, translator, api, hooks, bootbox, alerts, bootstrap) {
			const Endorse = {};
			let _showTooltip = {};

			Endorse.addEndorseHandler = function () {
				_showTooltip = {};
				components.get('topic').on('mouseenter', '[data-pid] [component="post/endorse-count"]', loadDataAndCreateTooltip);
				components.get('topic').on('mouseleave', '[data-pid] [component="post/endorse-count"]', destroyTooltip);
			};

			function destroyTooltip() {
				const $this = $(this);
				const pid = $this.parents('[data-pid]').attr('data-pid');
				const tooltip = bootstrap.Tooltip.getInstance(this);
				if (tooltip) {
					tooltip.dispose();
					$this.attr('title', '');
				}
				_showTooltip[pid] = false;
			}

			function loadDataAndCreateTooltip() {
				const $this = $(this);
				const el = $this.parent();
				const pid = el.parents('[data-pid]').attr('data-pid');
				_showTooltip[pid] = true;
				const tooltip = bootstrap.Tooltip.getInstance(this);
				if (tooltip) {
					tooltip.dispose();
					$this.attr('title', '');
				}

				const path = '/posts/' + encodeURIComponent(pid) + '/endorsers';

				api.get(path, {}, function (err, data) {
					if (err) {
						return alerts.error(err);
					}
					if (_showTooltip[pid] && data) {
						createTooltip($this, data);
					}
				});
			}

			function createTooltip(el, data) {
				function doCreateTooltip(title) {
					el.attr('title', title);
					(new bootstrap.Tooltip(el, {
						container: '#content',
						html: true,
					})).show();
				}

				let usernames = data.usernames
					.filter(function (name) { return name !== '[[global:former-user]]'; });
				if (!usernames.length) {
					return;
				}
				if (usernames.length + data.otherCount > data.cutoff) {
					usernames = usernames.join(', ').replace(/,/g, '|');
					translator.translate('[[topic:users-and-others, ' + usernames + ', ' + data.otherCount + ']]', function (translated) {
						translated = translated.replace(/\|/g, ',');
						doCreateTooltip(translated);
					});
				} else {
					usernames = usernames.join(', ');
					doCreateTooltip(usernames);
				}
			}

			Endorse.toggleEndorse = function (button) {
				const post = button.closest('[data-pid]');
				const currentState = post.find('.endorsed').length;

				const method = currentState ? 'del' : 'put';
				const pid = post.attr('data-pid');
				api[method]('/posts/' + encodeURIComponent(pid) + '/endorse', {}, function (err) {
					if (err) {
						if (!app.user.uid) {
							ajaxify.go('login');
							return;
						}
						return alerts.error(err);
					}
					hooks.fire('action:post.toggledEndorse', {
						pid: pid,
						unendorse: method === 'del',
					});
				});

				return false;
			};

			return Endorse;
		});
            $this.attr('title', '');
