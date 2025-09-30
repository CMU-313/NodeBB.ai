'use strict';

const user = require('../user');
const plugins = require('../plugins');

module.exports = function (SocketUser) {
	SocketUser.updateHelpfulnessScore = async function (socket, data) {
		if (!socket.uid || !data.uid) {
			throw new Error('[[error:invalid-data]]');
		}

		// Update the helpfulness score
		const score = await user.updateHelpfulnessScore(data.uid);

		// Notify other clients about the update
		const sockets = await plugins.hooks.fire('filter:sockets.sendToUids', {
			uids: [data.uid],
			socket: socket,
		});

		sockets.forEach((recipientSocket) => {
			recipientSocket.emit('event:user.helpfulnessUpdate', {
				uid: data.uid,
				score: score,
			});
		});

		return score;
	};
};