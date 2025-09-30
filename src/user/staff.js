'use strict';

const db = require('../database');
const plugins = require('../plugins');

module.exports = function (User) {
	User.isStaff = async function (uid) {
		if (parseInt(uid, 10) <= 0) {
			return false;
		}
		return await User.getUserField(uid, 'isStaff');
	};

	User.setStaff = async function (uid, isStaff) {
		if (parseInt(uid, 10) <= 0) {
			return;
		}
		await User.setUserField(uid, 'isStaff', isStaff ? 1 : 0);
		await plugins.hooks.fire('action:user.staff.update', { uid: uid, isStaff: isStaff });
	};

	User.getStaffUids = async function () {
		return await db.getSortedSetRevRangeByScore('users:joindate', 0, -1, '+inf', 0,
			uids => uids.filter(uid => User.getUserField(uid, 'isStaff')));
	};
};