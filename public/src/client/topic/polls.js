define('client/topic/polls', ['components/ajax', 'translator', 'alerts'], function (ajax, translator, alerts) {
	'use strict';

	const Polls = {};

	Polls.render = async function (selector, pollId) {
		try {
			const data = await ajax.get(`/api/v3/polls/${encodeURIComponent(pollId)}`);
			if (!data) return;
			const html = await app.parseAndTranslate('partials/topic/poll', data);
			$(selector).append(html);
			// attach handlers
			$(selector).find('[component="poll-option"]').on('click', async function (e) {
				e.preventDefault();
				const optionId = $(this).data('option-id');
				try {
					await ajax.put(`/api/v3/polls/${encodeURIComponent(pollId)}/vote`, { optionId });
					// refresh
					const refreshed = await ajax.get(`/api/v3/polls/${encodeURIComponent(pollId)}`);
					const newHtml = await app.parseAndTranslate('partials/topic/poll', refreshed);
					$(selector).find('[component="poll-block"]').replaceWith(newHtml);
				} catch (err) {
					alerts.alert('[[error:request-failed]]');
				}
			});
		} catch (err) {
			console.warn('Failed to load poll', err);
		}
	};

	return Polls;
});
