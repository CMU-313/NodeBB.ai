'use strict';

define('forum/helpfulness', ['hooks', 'alerts'], function (hooks, alerts) {
	const Helpfulness = {};

	Helpfulness.init = function () {
		hooks.on('action:post.upvoted', onPostUpvoted);
		hooks.on('action:post.acceptAnswer', onPostAccepted);
	};

	function onPostUpvoted(data) {
		if (data && data.post && data.post.uid) {
			updateHelpfulnessScore(data.post.uid);
		}
	}

	function onPostAccepted(data) {
		if (data && data.uid) {
			updateHelpfulnessScore(data.uid);
		}
	}

	function updateHelpfulnessScore(uid) {
		socket.emit('user.updateHelpfulnessScore', { uid: uid }, function (err, newScore) {
			if (err) {
				return alerts.error(err);
			}
			
			// Update helpfulness badges in the UI
			$('[data-uid="' + uid + '"] .helpfulness-badge .badge').text(newScore);
		});
	}

	return Helpfulness;
});