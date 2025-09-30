'use strict';

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

	function setupSkinSwitcher() {
		$('[component="skinSwitcher"]').on('click', '.dropdown-item', function () {
			const skin = $(this).attr('data-value');
			$('[component="skinSwitcher"] .dropdown-item .fa-check').addClass('invisible');
			$(this).find('.fa-check').removeClass('invisible');
			require(['forum/account/settings', 'hooks'], function (accountSettings, hooks) {
				hooks.one('action:skin.change', function () {
					$('[component="skinSwitcher"] [component="skinSwitcher/icon"]').removeClass('fa-fade');
				});
				$('[component="skinSwitcher"] [component="skinSwitcher/icon"]').addClass('fa-fade');
				accountSettings.changeSkin(skin);
			});
		});
	}

	require(['hooks'], function (hooks) {
		$(window).on('action:composer.resize action:sidebar.toggle', function () {
			const isRtl = $('html').attr('data-dir') === 'rtl';
			const css = {
				width: $('#panel').width(),
			};
			const sidebarEl = $('.sidebar-left');
			css[isRtl ? 'right' : 'left'] = sidebarEl.is(':visible') ? sidebarEl.outerWidth(true) : 0;
			$('[component="composer"]').css(css);
		});

		// Attach comments visibility data to composer params when creating posts/topics
		hooks.on('action:composer.post.new', function (hookData) {
			try {
				const composerEl = $('[component="composer"]');
				if (!composerEl.length) return hookData;
				const select = composerEl.find('[component="composer/comments-visibility/select"]');
				if (!select.length) return hookData;
				hookData.commentsVisibility = select.val();
				const specific = composerEl.find('[component="composer/comments-visibility/specific/input"]');
				hookData.commentsSpecific = specific.length ? specific.val() : '';
				return hookData;
			} catch (e) {
				console.error('error attaching comments visibility', e);
				return hookData;
			}
		});

		hooks.on('action:composer.topic.new', function (hookData) {
			// also include for new topic composer
			try {
				const composerEl = $('[component="composer"]');
				if (!composerEl.length) return hookData;
				const select = composerEl.find('[component="composer/comments-visibility/select"]');
				if (!select.length) return hookData;
				hookData.commentsVisibility = select.val();
				const specific = composerEl.find('[component="composer/comments-visibility/specific/input"]');
				hookData.commentsSpecific = specific.length ? specific.val() : '';
				return hookData;
			} catch (e) {
				console.error('error attaching comments visibility to topic', e);
				return hookData;
			}
		});

		hooks.on('filter:chat.openChat', function (hookData) {
			// disables chat modals & goes straight to chat page based on user setting
			hookData.modal = config.theme.chatModals && !utils.isMobile();
			return hookData;
		});
	});

	function setupMobileMenu() {
		require(['hooks', 'api', 'navigator'], function (hooks, api, navigator) {
			$('[component="sidebar/toggle"]').on('click', async function () {
				const sidebarEl = $('.sidebar');
				sidebarEl.toggleClass('open');
				if (app.user.uid) {
					await api.put(`/users/${app.user.uid}/settings`, {
						settings: {
							openSidebars: sidebarEl.hasClass('open') ? 'on' : 'off',
						},
					});
				}
				$(window).trigger('action:sidebar.toggle');
				if (ajaxify.data.template.topic) {
					hooks.fire('action:navigator.update', { newIndex: navigator.getIndex() });
				}
			});

			const bottomBar = $('[component="bottombar"]');
			let stickyTools = null;
			const location = config.theme.topMobilebar ? 'top' : 'bottom';
			const $body = $('body');
			const $window = $(window);
			$body.on('shown.bs.dropdown hidden.bs.dropdown', '.sticky-tools', function () {
				bottomBar.toggleClass('hidden', $(this).find('.dropdown-menu.show').length);
			});
			function isSearchVisible() {
				return !!$('[component="bottombar"] [component="sidebar/search"] .search-dropdown.show').length;
			}

			let lastScrollTop = $window.scrollTop();
			let newPostsLoaded = false;

			function onWindowScroll() {
				const st = $window.scrollTop();
				if (newPostsLoaded) {
					newPostsLoaded = false;
					lastScrollTop = st;
					return;
				}
				if (st !== lastScrollTop && !navigator.scrollActive && !isSearchVisible()) {
					const diff = Math.abs(st - lastScrollTop);
					const scrolledDown = st > lastScrollTop;
					const scrolledUp = st < lastScrollTop;
					const isHiding = !scrolledUp && scrolledDown;
					if (diff > 10) {
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

			const delayedScroll = utils.throttle(onWindowScroll, 250);
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

	function setupDrafts() {
		require(['composer/drafts', 'bootbox'], function (drafts, bootbox) {
			const draftsEl = $('[component="sidebar/drafts"]');

			function updateBadgeCount() {
				const count = drafts.getAvailableCount();
				if (count > 0) {
					draftsEl.removeClass('hidden');
				}
				$('[component="drafts/count"]').toggleClass('hidden', count <= 0).text(count);
			}

			async function renderDraftList() {
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
						draft.text = utils.escapeHTML(
							draft.text
						).replace(/(?:\r\n|\r|\n)/g, '<br>');
					}
				});

				const html = await app.parseAndTranslate('partials/sidebar/drafts', 'drafts', { drafts: draftItems });
				draftListEl.find('.no-drafts').addClass('hidden');
				draftListEl.find('.placeholder-wave').addClass('hidden');
				draftListEl.find('.draft-item-container').html(html).find('.timeago').timeago();
			}


			draftsEl.on('shown.bs.dropdown', renderDraftList);

			draftsEl.on('click', '[component="drafts/open"]', function () {
				drafts.open($(this).attr('data-save-id'));
			});

			draftsEl.on('click', '[component="drafts/delete"]', function () {
				const save_id = $(this).attr('data-save-id');
				bootbox.confirm('[[modules:composer.discard-draft-confirm]]', function (ok) {
					if (ok) {
						drafts.removeDraft(save_id);
						renderDraftList();
					}
				});
				return false;
			});

			$(window).on('action:composer.drafts.save', updateBadgeCount);
			$(window).on('action:composer.drafts.remove', updateBadgeCount);
			updateBadgeCount();
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
			hooks.on('action:composer.open', function (hookData) {
				try {
					// Only show for the Comments & Feedback category (install/data/categories.json name)
					const cid = hookData && hookData.cid;
					if (!cid) return;
					// Attempt to find category name on the page
					const categoryName = $('.topic .category a, [component="topic/category"]').first().text().trim();
					if (!/comments\s*&\s*feedback/i.test(categoryName)) return;

					const composerEl = $('[component="composer"]');
					if (!composerEl.length) return;

					// Avoid adding duplicate control
					if (composerEl.find('[component="composer/comments-visibility"]').length) return;

					const html = `
					<div component="composer/comments-visibility" class="composer-field my-2">
						<label class="form-label mb-1">Comments visibility</label>
						<select class="form-select" component="composer/comments-visibility/select">
							<option value="everyone">Everyone</option>
							<option value="instructors">Instructors only</option>
							<option value="specific">Specific instructors</option>
						</select>
						<div component="composer/comments-visibility/specific" class="mt-2 hidden">
							<label class="form-label mb-1">Specific instructors (comma-separated usernames)</label>
							<input type="text" class="form-control" component="composer/comments-visibility/specific/input" placeholder="instructor1,instructor2" />
						</div>
					</div>`;

					composerEl.find('.additional-options, [component="composer/additional"]').first().append(html);

					// Wire up events
					composerEl.off('change', '[component="composer/comments-visibility/select"]').on('change', '[component="composer/comments-visibility/select"]', function () {
						const val = $(this).val();
						composerEl.find('[component="composer/comments-visibility/specific"]').toggleClass('hidden', val !== 'specific');
					});
				} catch (e) {
					// silently fail so composer still works
					console.error('comments visibility control error', e);
				}
			});
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
});
