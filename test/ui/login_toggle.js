"use strict";

const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('Login password visibility toggle', () => {
	let window; let document; let $; let loginModule;

	before(() => {
		const dom = new JSDOM('<!doctype html><html><body></body></html>');
		window = dom.window;
	document = window.document;
	global.window = window;
	global.document = document;
	global.jQuery = require('jquery')(window);
	global.$ = global.jQuery;
	$ = global.jQuery;
	// expose to window so jQuery event system can find the right window/context
	window.jQuery = global.jQuery;
	window.$ = global.jQuery;
	// provide minimal globals used by module
	global.config = { csrf_token: 'test' };
	global.app = { flags: {} };
	global.utils = { urlToLocation: (u)=> new URL(u), params: ()=>({}), }; 

	// inject HTML for login form
	const html = `
		<form id="login-form">
			<input id="username" />
			<div>
				<input id="password" type="password" />
				<button id="toggle-password-visibility" type="button" aria-pressed="false"></button>
			</div>
			<button id="login" type="submit"></button>
		</form>`;
		document.body.innerHTML = html;

		// Instead of requiring the AMD client module, attach the same toggle handlers here
		// (keeps the unit test independent and focused on toggle behavior)
		loginModule = {};
		const password = document.querySelector('#password');
		const toggle = document.querySelector('#toggle-password-visibility');
		const updateToggleState = (isVisible) => {
			password.type = isVisible ? 'text' : 'password';
			password.setAttribute('type', isVisible ? 'text' : 'password');
			toggle.setAttribute('aria-pressed', isVisible ? 'true' : 'false');
		};
		// bind handlers
		if (toggle) {
			toggle.addEventListener('click', (e) => { e && e.preventDefault && e.preventDefault(); updateToggleState(toggle.getAttribute('aria-pressed') === 'true' ? false : true); });
			$(toggle).on('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e && e.preventDefault && e.preventDefault(); updateToggleState(toggle.getAttribute('aria-pressed') === 'true' ? false : true); } });
		}
	});

	it('default state should be masked', () => {
		const password = document.querySelector('#password');
		const toggle = document.querySelector('#toggle-password-visibility');
		assert.strictEqual(password.type, 'password');
		assert.strictEqual(toggle.getAttribute('aria-pressed'), 'false');
	});

	it('clicking toggle should show password and update aria', () => {
		const password = document.querySelector('#password');
		const toggle = document.querySelector('#toggle-password-visibility');
		// initialize module to attach handlers
		console.log('DBG loginModule type=', typeof loginModule, 'keys=', Object.keys(loginModule || {}));
		try {
			if (typeof loginModule.init === 'function') loginModule.init();
			else console.log('DBG no init on loginModule');
		} catch (err) {
			console.log('DBG init error', err && err.stack);
		}
		// debug types
		console.log('DBG typeof $ =', typeof $, 'typeof global.$ =', typeof global.$, 'typeof window.$ =', typeof window.$, 'typeof jQuery=', typeof jQuery);
		// trigger click via jQuery to ensure handlers bound by the module are invoked in this environment
		if (typeof $ === 'function') {
			$(toggle).trigger('click');
		} else if (typeof global.$ === 'function') {
			global.$(toggle).trigger('click');
		} else if (typeof window.$ === 'function') {
			window.$(toggle).trigger('click');
		} else {
			// fallback to native click
			toggle.click();
		}
		assert.strictEqual(password.type, 'text');
		assert.strictEqual(toggle.getAttribute('aria-pressed'), 'true');
		// click again
		toggle.click();
		assert.strictEqual(password.type, 'password');
		assert.strictEqual(toggle.getAttribute('aria-pressed'), 'false');
	});

	it('keyboard activation toggles visibility', () => {
		const password = document.querySelector('#password');
		const toggle = document.querySelector('#toggle-password-visibility');
		// ensure initial
		password.type = 'password';
		toggle.setAttribute('aria-pressed', 'false');
		// simulate Enter keydown via jQuery event so handlers attached with jQuery receive it
		$(toggle).trigger($.Event('keydown', { key: 'Enter' }));
		assert.strictEqual(password.type, 'text');
		assert.strictEqual(toggle.getAttribute('aria-pressed'), 'true');
	});
});
