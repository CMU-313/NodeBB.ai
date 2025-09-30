'use strict';


define('forum/login', ['hooks', 'translator', 'jquery-form'], function (hooks, translator) {
	const Login = {
		_capsState: false,
	};

	Login.init = function () {
		const errorEl = $('#login-error-notify');
		const submitEl = $('#login');
		const formEl = $('#login-form');

		submitEl.on('click', async function (e) {
			e.preventDefault();
			const username = $('#username').val();
			const password = $('#password').val();
			errorEl.addClass('hidden').find('p').text('');
			if (!username || !password) {
				errorEl.find('p').translateText('[[error:invalid-username-or-password]]');
				errorEl.removeClass('hidden');
				return;
			}

			if (submitEl.hasClass('disabled')) {
				return;
			}

			submitEl.addClass('disabled');

			try {
				const hookData = await hooks.fire('filter:app.login', {
					username,
					password,
					cancel: false,
				});
				if (hookData.cancel) {
					submitEl.removeClass('disabled');
					return;
				}
			} catch (err) {
				errorEl.find('p').translateText(err.message);
				errorEl.removeClass('hidden');
				submitEl.removeClass('disabled');
				return;
			}

			hooks.fire('action:app.login');
			formEl.ajaxSubmit({
				headers: {
					'x-csrf-token': config.csrf_token,
				},
				beforeSend: function () {
					app.flags._login = true;
				},
				success: function (data) {
					hooks.fire('action:app.loggedIn', data);
					const pathname = utils.urlToLocation(data.next).pathname;
					const params = utils.params({ url: data.next });
					params.loggedin = true;
					delete params.register; // clear register message incase it exists
					const qs = $.param(params);

					window.location.href = pathname + '?' + qs;
				},
				error: function (data) {
					let message = data.responseText;
					const errInfo = data.responseJSON;
					if (data.status === 403 && data.responseText === 'Forbidden') {
						window.location.href = config.relative_path + '/login?error=csrf-invalid';
					} else if (errInfo && errInfo.hasOwnProperty('banned_until')) {
						message = errInfo.banned_until ?
							translator.compile('error:user-banned-reason-until', (new Date(errInfo.banned_until).toLocaleString()), errInfo.reason) :
							'[[error:user-banned-reason, ' + errInfo.reason + ']]';
					}
					errorEl.find('p').translateText(message);
					errorEl.removeClass('hidden');
					submitEl.removeClass('disabled');

					// Select the entire password if that field has focus
					if ($('#password:focus').length) {
						$('#password').select();
					}
				},
			});
		});

		// Guard against caps lock
		Login.capsLockCheck(document.querySelector('#password'), document.querySelector('#caps-lock-warning'));

		// Password visibility toggle
		const passwordEl = document.querySelector('#password');
		const toggleEl = document.querySelector('#toggle-password-visibility');


		const updateToggleState = (isVisible) => {
			if (!toggleEl || !passwordEl) return;
			// set both property and attribute to be robust across environments (jsdom etc.)
			passwordEl.type = isVisible ? 'text' : 'password';
			passwordEl.setAttribute('type', isVisible ? 'text' : 'password');
			toggleEl.setAttribute('aria-pressed', isVisible ? 'true' : 'false');
			// Update accessible label and icon
			if (isVisible) {
				toggleEl.setAttribute('aria-label', '[[login:hide-password]]');
				$(toggleEl).find('i').removeClass('fa-eye').addClass('fa-eye-slash');
			} else {
				toggleEl.setAttribute('aria-label', '[[login:show-password]]');
				$(toggleEl).find('i').removeClass('fa-eye-slash').addClass('fa-eye');
			}
		};

		if (toggleEl) {
			// Ensure default state is hidden
			updateToggleState(false);

			// Attach both native and jQuery handlers to be robust across environments
			const clickHandler = function (e) {
				e && e.preventDefault && e.preventDefault();

				const isVisible = toggleEl.getAttribute('aria-pressed') === 'true';
				updateToggleState(!isVisible);
			};
			const keyHandler = function (e) {
				const key = e && e.key;
				if (key === ' ' || key === 'Enter') {
					e && e.preventDefault && e.preventDefault();
					const isVisible = toggleEl.getAttribute('aria-pressed') === 'true';
					updateToggleState(!isVisible);
				}
			};

			try {
				// native bindings
				toggleEl.addEventListener('click', clickHandler);
				toggleEl.addEventListener('keydown', keyHandler);
			} catch (err) {
				// ignore if not supported
			}

			try {
				if (window && window.jQuery) {
					window.jQuery(toggleEl).on('click', clickHandler).on('keydown', keyHandler);
				}
			} catch (err) {
				// ignore
			}
		}

		if ($('#content #username').val()) {
			$('#content #password').val('').focus();
		} else {
			$('#content #username').focus();
		}
		$('#content #noscript').val('false');
	};

	Login.capsLockCheck = (inputEl, warningEl) => {
		const toggle = (state) => {
			warningEl.classList[state ? 'remove' : 'add']('hidden');
			warningEl.parentNode.classList[state ? 'add' : 'remove']('has-warning');
		};
		if (!inputEl) {
			return;
		}
		inputEl.addEventListener('keyup', function (e) {
			if (Login._capsState && e.key === 'CapsLock') {
				toggle(false);
				Login._capsState = !Login._capsState;
				return;
			}
			Login._capsState = e.getModifierState && e.getModifierState('CapsLock');
			toggle(Login._capsState);
		});

		if (Login._capsState) {
			toggle(true);
		}
	};

	return Login;
});
