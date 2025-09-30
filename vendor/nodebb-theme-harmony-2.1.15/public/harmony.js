(function () {
	'use strict';

	// Constants
	const SCROLL_DIFF_THRESHOLD = 10;
	const THROTTLE_DELAY = 250;

	$(document).ready(function () {
		setupSkinSwitcher();
		setupNProgress();
		setupMobileMenu();
		setupSearch();
		setupDrafts();
		handleMobileNavigator();
		setupNavTooltips();
		fixPlaceholders();
		fixSidebarOverflow();
	});

	function setupSkinSwitcher() {
		const skinSwitcher = $('[component="skinSwitcher"]');

		skinSwitcher.on('click', '.dropdown-item', function () {
			const skin = $(this).attr('data-value');
			skinSwitcher.find('.dropdown-item .fa-check').addClass('invisible');
			$(this).find('.fa-check').removeClass('invisible');
			require(['forum/account/settings', 'hooks'], function (accountSettings, hooks) {
				hooks.one('action:skin.change', function () {
					skinSwitcher.find('[component="skinSwitcher/icon"]').removeClass('fa-fade');
				});
				skinSwitcher.find('[component="skinSwitcher/icon"]').addClass('fa-fade');
				accountSettings.changeSkin(skin);
			});
		});
	}

	function setupMobileMenu() {
		require(['hooks', 'api', 'navigator'], function (hooks, api, navigator) {
			const sidebarEl = $('.sidebar');
			const bottomBar = $('[component="bottombar"]');
			const $window = $(window);
			let stickyTools = null;
			const location = config.theme.topMobilebar ? 'top' : 'bottom';

			$('[component="sidebar/toggle"]').on('click', async function () {
				sidebarEl.toggleClass('open');
				if (app.user.uid) {
					await api.put(`/users/${app.user.uid}/settings`, {
						settings: {
							openSidebars: sidebarEl.hasClass('open') ? 'on' : 'off',
						},
					});
				}
				$window.trigger('action:sidebar.toggle');
				if (ajaxify.data.template.topic) {
					hooks.fire('action:navigator.update', { newIndex: navigator.getIndex() });
				}
			});

			let lastScrollTop = $window.scrollTop();
			let newPostsLoaded = false;

			function handleScroll() {
				const st = $window.scrollTop();
				if (newPostsLoaded) {
					newPostsLoaded = false;
					lastScrollTop = st;
					return;
				}
				if (st !== lastScrollTop && !navigator.scrollActive) {
					const diff = Math.abs(st - lastScrollTop);
					const scrolledDown = st > lastScrollTop;
					const scrolledUp = st < lastScrollTop;
					const isHiding = !scrolledUp && scrolledDown;
					if (diff > SCROLL_DIFF_THRESHOLD) {
						bottomBar.css({
							[location]: isHiding ?
								-bottomBar.find('.bottombar-nav').outerHeight(true) :
								0,
						});
						if (stickyTools && config.theme.topMobilebar && config.theme.autohideBottombar) {
							stickyTools.css({
								top: isHiding ? 0 : 'var(--panel-offset)',
							});
						}
					}
				}
				lastScrollTop = st;
			}

			const delayedScroll = utils.throttle(handleScroll, THROTTLE_DELAY);
			function enableAutohide() {
				$window.off('scroll', delayedScroll);
				if (config.theme.autohideBottombar) {
					lastScrollTop = $window.scrollTop();
					$window.on('scroll', delayedScroll);
				}
			}

			hooks.on('action:posts.loading', function () {
				$window.off('scroll', delayedScroll);
			});
			hooks.on('action:posts.loaded', function () {
				newPostsLoaded = true;
				setTimeout(enableAutohide, 250);
			});
			hooks.on('action:ajaxify.end', function () {
				bottomBar.removeClass('hidden');
				const { template } = ajaxify.data;
				stickyTools = (template.category || template.topic) ? $('.sticky-tools') : null;
				$window.off('scroll', delayedScroll);
				if (config.theme.autohideBottombar) {
					bottomBar.css({ [location]: 0 });
					setTimeout(enableAutohide, 250);
				}
			});
		});
	}

	function setupSearch() {
		$('[component="sidebar/search"]').on('shown.bs.dropdown', function () {
			$(this).find('[component="search/fields"] input[name="query"]').trigger('focus');
		});
	}

	function updateDraftBadgeCount(draftsEl, drafts) {
		const count = drafts.getAvailableCount();
		if (count > 0) {
			draftsEl.removeClass('hidden');
		}
		$('[component="drafts/count"]').toggleClass('hidden', count <= 0).text(count);
	}

	async function renderDraftList(draftsEl, drafts) {
		const draftListEl = $('[component="drafts/list"]');
		const draftItems = drafts.listAvailable();
		if (!draftItems.length) {
			draftListEl.find('.no-drafts').removeClass('hidden');
			draftListEl.find('.placeholder-wave').addClass('hidden');
			draftListEl.find('.draft-item-container').html('');
			return;
		}
		draftItems.reverse().forEach((draft) => {
			if (draft) {
				if (draft.title) {
					draft.title = utils.escapeHTML(String(draft.title));
				}
				draft.text = utils.escapeHTML(draft.text).replace(/(?:\r\n|\r|\n)/g, '<br>');
			}
		});

		const html = await app.parseAndTranslate('partials/sidebar/drafts', 'drafts', { drafts: draftItems });
		draftListEl.find('.no-drafts').addClass('hidden');
		draftListEl.find('.placeholder-wave').addClass('hidden');
		draftListEl.find('.draft-item-container').html(html).find('.timeago').timeago();
	}

	function attachDraftEventListeners(draftsEl, drafts, bootbox) {
		draftsEl.on('shown.bs.dropdown', () => renderDraftList(draftsEl, drafts));
		draftsEl.on('click', '[component="drafts/open"]', function () {
			drafts.open($(this).attr('data-save-id'));
		});
		draftsEl.on('click', '[component="drafts/delete"]', function () {
			const save_id = $(this).attr('data-save-id');
			bootbox.confirm('[[modules:composer.discard-draft-confirm]]', function (ok) {
				if (ok) {
					drafts.removeDraft(save_id);
					renderDraftList(draftsEl, drafts);
				}
			});
			return false;
		});
		$(window).on('action:composer.drafts.save', () => updateDraftBadgeCount(draftsEl, drafts));
		$(window).on('action:composer.drafts.remove', () => updateDraftBadgeCount(draftsEl, drafts));
	}

	function setupDrafts() {
		require(['composer/drafts', 'bootbox'], function (drafts, bootbox) {
			const draftsEl = $('[component="sidebar/drafts"]');
			updateDraftBadgeCount(draftsEl, drafts);
			attachDraftEventListeners(draftsEl, drafts, bootbox);
		});
	}

	function setupNProgress() {
		require(['nprogress'], function (NProgress) {
			window.nprogress = NProgress;
			if (NProgress) {
				$(window).on('action:ajaxify.start', function () {
					NProgress.set(0.7);
				});

				$(window).on('action:ajaxify.end', function () {
					NProgress.done(true);
				});
			}
		});
	}

	function handleMobileNavigator() {
		const paginationBlockEl = $('.pagination-block');
		require(['hooks'], function (hooks) {
			hooks.on('action:ajaxify.end', function () {
				paginationBlockEl.find('.dropdown-menu.show').removeClass('show');
			});
			hooks.on('filter:navigator.scroll', function (hookData) {
				paginationBlockEl.find('.dropdown-menu.show').removeClass('show');
				return hookData;
			});
		});
	}

	function setupNavTooltips() {
		// remove title from user icon in sidebar to prevent double tooltip
		$('.sidebar [component="header/avatar"] .avatar').removeAttr('title');
		const tooltipEls = $('.sidebar [title]');
		const lefttooltipEls = $('.sidebar-left [title]');
		const rightooltipEls = $('.sidebar-right [title]');
		const isRtl = $('html').attr('data-dir') === 'rtl';
		lefttooltipEls.tooltip({
			trigger: 'manual',
			animation: false,
			placement: isRtl ? 'left' : 'right',
		});
		rightooltipEls.tooltip({
			trigger: 'manual',
			animation: false,
			placement: isRtl ? 'right' : 'left',
		});

		tooltipEls.on('mouseenter', function (ev) {
			const target = $(ev.target);
			const isDropdown = target.hasClass('dropdown-menu') || !!target.parents('.dropdown-menu').length;
			if (!$('.sidebar').hasClass('open') && !isDropdown) {
				$(this).tooltip('show');
			}
		});
		tooltipEls.on('click mouseleave', function () {
			$(this).tooltip('hide');
		});
	}

	function fixPlaceholders() {
		if (!config.loggedIn) {
			return;
		}
		['notifications', 'chat'].forEach((type) => {
			const countEl = $(`nav.sidebar [component="${type}/count"]`).first();
			if (!countEl.length) {
				return;
			}
			const count = parseInt(countEl.text(), 10);
			if (count > 1) {
				const listEls = $(`.dropdown-menu [component="${type}/list"]`);
				listEls.each((index, el) => {
					const placeholder = $(el).children().first();
					for (let x = 0; x < count - 1; x++) {
						const cloneEl = placeholder.clone(true);
						cloneEl.insertAfter(placeholder);
					}
				});
			}
		});
	}

	function fixSidebarOverflow() {
		// overflow-y-auto needs to be removed on main-nav when dropdowns are opened
		const mainNavEl = $('#main-nav');
		function toggleOverflow() {
			mainNavEl.toggleClass(
				'overflow-y-auto',
				!mainNavEl.find('.dropdown-menu.show').length
			);
		}
		mainNavEl.on('shown.bs.dropdown', toggleOverflow)
			.on('hidden.bs.dropdown', toggleOverflow);
	}
})();
