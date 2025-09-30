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
            queue: queue 
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
                await this.doLogin();
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

    async doLogin() {
        // This would be implemented in the authentication controller
        // but referenced here for completeness
        return Promise.resolve();
    }

    async addToApprovalQueue() {
        const data = await user.addToApprovalQueue({
            username: this.userData.username,
            email: this.userData.email,
            ip: this.req.ip,
        });
        return { referrer: this.userData.referrer || nconf.get('relative_path') + '/', message: '[[register:registration-added-to-queue]]', data };
    }
}

module.exports = UserRegistration;