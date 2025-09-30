'use strict';

define('client/polls', ['api', 'hooks', 'alerts'], function (api, hooks, alerts) {
	const Polls = {};

	const STORAGE_KEY = 'nodebb.ai.polls';

	function readPolls() {
		try {
			return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
		} catch (e) {
			return [];
		}
	}

	function writePolls(polls) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(polls));
	}

	function makePollHtml(poll, index, isOwner, canCreate) {
		const container = document.createElement('div');
		container.className = 'card mb-3 poll-card';
		const body = document.createElement('div');
		body.className = 'card-body';

		const title = document.createElement('h5');
		title.className = 'card-title';
		title.textContent = poll.title;
		body.appendChild(title);

		if (!poll.options || !poll.options.length) {
			const p = document.createElement('p');
			p.textContent = 'No options';
			body.appendChild(p);
		} else {
			const list = document.createElement('div');
			list.className = 'poll-options';

			const totalVotes = poll.votes ? poll.votes.reduce((s, v) => s + v, 0) : 0;

			poll.options.forEach((opt, i) => {
				const optWrap = document.createElement('div');
				optWrap.className = 'mb-2';

				const btn = document.createElement('button');
				btn.className = 'btn btn-sm btn-outline-primary me-2';
				btn.textContent = opt;
				btn.dataset.pollIndex = index;
				btn.dataset.optIndex = i;

				btn.addEventListener('click', function () {
					Polls.vote(parseInt(this.dataset.pollIndex, 10), parseInt(this.dataset.optIndex, 10));
				});

				const pct = totalVotes ? Math.round((poll.votes[i] / totalVotes) * 100) : 0;
				const badge = document.createElement('span');
				badge.className = 'text-muted';
				badge.textContent = ' ' + (poll.votes[i] || 0) + ' (' + pct + '%)';

				optWrap.appendChild(btn);
				optWrap.appendChild(badge);
				list.appendChild(optWrap);
			});

			body.appendChild(list);
		}

		const meta = document.createElement('div');
		meta.className = 'text-muted small mt-2';
		meta.textContent = 'Created: ' + new Date(poll.createdAt).toLocaleString();
		body.appendChild(meta);

		if (canCreate && isOwner) {
			const deleteBtn = document.createElement('button');
			deleteBtn.className = 'btn btn-danger btn-sm mt-2';
			deleteBtn.textContent = 'Delete poll';
			deleteBtn.addEventListener('click', function () {
				const polls = readPolls();
				polls.splice(index, 1);
				writePolls(polls);
				render();
			});
			body.appendChild(deleteBtn);
		}

		container.appendChild(body);
		return container;
	}

	async function render() {
		const polls = readPolls();

		// find sidebar widget area
		let area = document.querySelector('[data-widget-area="sidebar"], [widget-area="sidebar"]');
		if (!area) {
			// fallback to header
			area = document.querySelector('[data-widget-area="header"], [widget-area="header"]') || document.getElementById('content');
		}

		if (!area) {
			return;
		}

		// Clear any existing poll widget
		let root = area.querySelector('.nodebb-ai-polls-root');
		if (!root) {
			root = document.createElement('div');
			root.className = 'nodebb-ai-polls-root';
			area.prepend(root);
		}

		root.innerHTML = '';

		const header = document.createElement('div');
		header.className = 'mb-3';
		header.innerHTML = '<h4 class="h6">Instructor Polls</h4>';
		root.appendChild(header);

		// show create UI if user is instructor
		const canCreate = !!(app.user && (app.user.isAdmin || app.user.isGlobalMod || (app.user.privileges && app.user.privileges['polls:create'])));

		if (canCreate) {
			const form = document.createElement('div');
			form.className = 'card card-body mb-3';

			const titleInput = document.createElement('input');
			titleInput.className = 'form-control mb-2';
			titleInput.placeholder = 'Poll question (e.g., What should we focus on?)';
			form.appendChild(titleInput);

			const optsInput = document.createElement('textarea');
			optsInput.className = 'form-control mb-2';
			optsInput.placeholder = 'Options, one per line';
			optsInput.rows = 3;
			form.appendChild(optsInput);

			const createBtn = document.createElement('button');
			createBtn.className = 'btn btn-primary';
			createBtn.textContent = 'Create poll';
			createBtn.addEventListener('click', function () {
				const title = titleInput.value.trim();
				const options = optsInput.value.split('\n').map(s => s.trim()).filter(Boolean);
				if (!title || options.length < 2) {
					alerts.error('Please provide a question and at least two options');
					return;
				}
				const polls = readPolls();
				polls.unshift({
					title: title,
					options: options,
					votes: options.map(() => 0),
					createdAt: Date.now(),
					owner: app.user ? app.user.uid : null,
				});
				writePolls(polls);
				titleInput.value = '';
				optsInput.value = '';
				render();
			});

			form.appendChild(createBtn);
			root.appendChild(form);
		}

		if (!polls.length) {
			const p = document.createElement('p');
			p.className = 'text-muted small';
			p.textContent = 'No polls yet.';
			root.appendChild(p);
			return;
		}

		polls.forEach((poll, i) => {
			const isOwner = app.user && String(poll.owner) === String(app.user.uid);
			const el = makePollHtml(poll, i, isOwner, canCreate);
			root.appendChild(el);
		});
	}

	Polls.vote = function (pollIndex, optIndex) {
		const polls = readPolls();
		const poll = polls[pollIndex];
		if (!poll) {
			alerts.error('Poll not found');
			return;
		}

		poll.votes[optIndex] = (poll.votes[optIndex] || 0) + 1;
		writePolls(polls);
		render();
	};

	Polls.init = function () {
		// render on load and when widgets loaded
		render();
		require(['hooks'], function (hooks) {
			hooks.on('action:widgets.loaded', function () {
				render();
			});
			hooks.on('action:app.load', function () {
				render();
			});
		});
	};

	return Polls;
});
