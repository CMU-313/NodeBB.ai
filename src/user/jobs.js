'use strict';

const winston = require('winston');
const cronJob = require('cron').CronJob;
const db = require('../database');
const meta = require('../meta');

const jobs = {};

function normalizeDigestHour(digestHour) {
	if (isNaN(digestHour)) {
		return 17;
	}

	if (digestHour > 23 || digestHour < 0) {
		return 0;
	}

	return digestHour;
}

module.exports = function (User) {
	User.startJobs = function () {
		winston.verbose('[user/jobs] (Re-)starting jobs...');
		const digestHour = normalizeDigestHour(meta.config.digestHour);

		User.stopJobs();

		startDigestJob('digest.daily', `0 ${digestHour} * * *`, 'day');
		startDigestJob('digest.weekly', `0 ${digestHour} * * 0`, 'week');
		startDigestJob('digest.monthly', `0 ${digestHour} 1 * *`, 'month');

		jobs['reset.clean'] = new cronJob('0 0 * * *', User.reset.clean, null, true);
		winston.verbose('[user/jobs] Starting job (reset.clean)');

		winston.verbose(`[user/jobs] jobs started`);
	};

	function startDigestJob(name, cronString, term) {
		jobs[name] = new cronJob(cronString, (async () => {
			winston.verbose(`[user/jobs] Digest job (${name}) started.`);
			try {
				await executeDigestForInterval(name, term, User);
			} catch (err) {
				winston.error(err.stack);
			}
		}), null, true);
		winston.verbose(`[user/jobs] Starting job (${name})`);
	}

	async function executeDigestForInterval(name, term, User) {
		if (name === 'digest.weekly') {
			const counter = await db.increment('biweeklydigestcounter');
			if (counter % 2) {
				await User.digest.execute({ interval: 'biweek' });
			}
		}

		await User.digest.execute({ interval: term });
	}

	User.stopJobs = function () {
		let terminated = 0;
		// Terminate any active cron jobs
		for (const jobId of Object.keys(jobs)) {
			winston.verbose(`[user/jobs] Terminating job (${jobId})`);
			jobs[jobId].stop();
			delete jobs[jobId];
			terminated += 1;
		}
		if (terminated > 0) {
			winston.verbose(`[user/jobs] ${terminated} jobs terminated`);
		}
	};
};
