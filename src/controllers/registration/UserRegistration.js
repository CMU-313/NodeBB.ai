'use strict';

const user = require('../../user');
const plugins = require('../../plugins');
const nconf = require('nconf');
const privileges = require('../../privileges');

class UserRegistration {
	constructor(req, res) {
		this.req = req;
		this.res = res;
		this.userData = {};
	}

	setUserData(userData) {
		this.userData = userData;
		if (!this.userData.hasOwnProperty('email')) {
			this.userData.updateEmail = true;
		}
		return this;
	}

	async handleInterstitials() {
		const data = await user.interstitials.get(this.req, this.userData);
		const deferRegistration = data.interstitials.length;

		if (deferRegistration) {
			this.userData.register = true;
			this.req.session.registration = this.userData;

			if (this.req.body?.noscript === 'true') {
				this.res.redirect(`${nconf.get('relative_path')}/register/complete`);
				return null;
			}
			this.res.json({ next: `${nconf.get('relative_path')}/register/complete` });
			return null;
		}
		return this;
	}

	async checkQueue() {
		const queue = await user.shouldQueueUser(this.req.ip);
		const result = await plugins.hooks.fire('filter:register.shouldQueue', { 
			req: this.req, 
			res: this.res, 
			userData: this.userData, 
			queue: queue,
		});

		if (result.queue) {
			return await this.addToApprovalQueue();
		}
		return this;
	}

	async createUser() {
		this.uid = await user.create(this.userData);
		return this;
	}

	async processLogin() {
		if (this.res.locals.processLogin) {
			const hasLoginPrivilege = await privileges.global.can('local:login', this.uid);
			if (hasLoginPrivilege) {
				const authenticationController = require('../authentication');
				await authenticationController.doLogin(this.req, this.uid);
			}
		}
		return this;
	}

	async handleInvitation() {
		if (this.userData.token) {
			await Promise.all([
				user.confirmIfInviteEmailIsUsed(this.userData.token, this.userData.email, this.uid),
				user.joinGroupsFromInvitation(this.uid, this.userData.token),
			]);
		}
		await user.deleteInvitationKey(this.userData.email, this.userData.token);
		return this;
	}

	async finalizeRegistration() {
		let next = this.req.session.returnTo || `${nconf.get('relative_path')}/`;
		if (this.req.loggedIn && next === `${nconf.get('relative_path')}/login`) {
			next = `${nconf.get('relative_path')}/`;
		}
		const complete = await plugins.hooks.fire('filter:register.complete', { uid: this.uid, next: next });
		this.req.session.returnTo = complete.next;
		return complete;
	}

	async addToApprovalQueue() {
		this.userData.ip = this.req.ip;
		await user.addToApprovalQueue(this.userData);
		let message = '[[register:registration-added-to-queue]]';
		
		const meta = require('../../meta');
		if (meta.config.showAverageApprovalTime) {
			const db = require('../../database');
			const average_time = await db.getObjectField('registration:queue:approval:times', 'average');
			if (average_time > 0) {
				message += ` [[register:registration-queue-average-time, ${Math.floor(average_time / 60)}, ${Math.floor(average_time % 60)}]]`;
			}
		}
		if (meta.config.autoApproveTime > 0) {
			message += ` [[register:registration-queue-auto-approve-time, ${meta.config.autoApproveTime}]]`;
		}
		return { message: message };
	}
}

module.exports = UserRegistration;