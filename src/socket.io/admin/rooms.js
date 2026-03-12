'use strict';

const topics = require('../../topics');
const io = require('..');
const webserver = require('../../webserver');

const totals = {};

const SocketRooms = module.exports;

SocketRooms.totals = totals;

SocketRooms.getTotalGuestCount = async function () {
	const s = await io.in('online_guests').fetchSockets();
	return s.length;
};

function initTotals() {
	totals.onlineGuestCount = 0;
	totals.onlineRegisteredCount = 0;
	totals.topTenTopics = [];
	totals.users = {
		categories: 0,
		recent: 0,
		unread: 0,
		topics: 0,
		category: 0,
	};
}

const roomHandlers = {
	online_guests: state => { state.totals.onlineGuestCount += 1; },
	categories: state => { state.totals.users.categories += 1; },
	recent_topics: state => { state.totals.users.recent += 1; },
	unread_topics: state => { state.totals.users.unread += 1; },
};

function handleTopicRoom(key, state) {
	const tid = key.match(/^topic_(\d+)/);
	if (tid) {
		state.totals.users.topics += 1;
		state.topicData[tid[1]] = state.topicData[tid[1]] || { count: 0 };
		state.topicData[tid[1]].count += 1;
	}
}

function categorizeRoom(key, state) {
	if (roomHandlers[key]) {
		roomHandlers[key](state);
	} else if (key.startsWith('uid_')) {
		state.userRooms[key] = 1;
	} else if (key.startsWith('category_')) {
		state.totals.users.category += 1;
	} else {
		handleTopicRoom(key, state);
	}
}

function countSocketRooms(sockets) {
	const state = { totals, userRooms: {}, topicData: {} };
	for (const s of sockets) {
		for (const key of s.rooms) {
			categorizeRoom(key, state);
		}
	}
	return { userRooms: state.userRooms, topicData: state.topicData };
}

async function buildTopTenTopics(topicData) {
	let topTenTopics = Object.keys(topicData).map(tid => ({ tid, count: topicData[tid].count }));
	topTenTopics = topTenTopics.sort((a, b) => b.count - a.count).slice(0, 10);
	const topTenTids = topTenTopics.map(topic => topic.tid);
	const titles = await topics.getTopicsFields(topTenTids, ['title']);
	return topTenTopics.map((topic, index) => {
		topic.title = titles[index].title;
		return topic;
	});
}

SocketRooms.getAll = async function () {
	const sockets = await io.server.fetchSockets();

	initTotals();
	totals.socketCount = sockets.length;

	const { userRooms, topicData } = countSocketRooms(sockets);
	totals.onlineRegisteredCount = Object.keys(userRooms).length;
	totals.topTenTopics = await buildTopTenTopics(topicData);

	return totals;
};

SocketRooms.getOnlineUserCount = function (io) {
	let count = 0;

	if (io) {
		for (const [key] of io.sockets.adapter.rooms) {
			if (key.startsWith('uid_')) {
				count += 1;
			}
		}
	}

	return count;
};

function collectLocalRoomStats(io, Sockets, socketData) {
	socketData.onlineGuestCount = Sockets.getCountInRoom('online_guests');
	socketData.onlineRegisteredCount = SocketRooms.getOnlineUserCount(io);
	socketData.socketCount = io.sockets.sockets.size;
	socketData.users.categories = Sockets.getCountInRoom('categories');
	socketData.users.recent = Sockets.getCountInRoom('recent_topics');
	socketData.users.unread = Sockets.getCountInRoom('unread_topics');

	const topTenTopics = [];
	for (const [room, clients] of io.sockets.adapter.rooms) {
		const tid = room.match(/^topic_(\d+)/);
		if (tid) {
			socketData.users.topics += clients.size;
			topTenTopics.push({ tid: tid[1], count: clients.size });
		} else if (room.match(/^category/)) {
			socketData.users.category += clients.size;
		}
	}
	socketData.topics = topTenTopics.sort((a, b) => b.count - a.count).slice(0, 10);
}

SocketRooms.getLocalStats = function () {
	const Sockets = require('../index');
	const io = Sockets.server;

	const socketData = {
		onlineGuestCount: 0,
		onlineRegisteredCount: 0,
		socketCount: 0,
		connectionCount: webserver.getConnectionCount(),
		users: {
			categories: 0,
			recent: 0,
			unread: 0,
			topics: 0,
			category: 0,
		},
		topics: {},
	};

	if (io && io.sockets) {
		collectLocalRoomStats(io, Sockets, socketData);
	}

	return socketData;
};

require('../../promisify')(SocketRooms);