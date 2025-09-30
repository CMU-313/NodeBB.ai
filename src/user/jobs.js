'use strict';

const winston = require('winston');
const cronJob = require('cron').CronJob;
const db = require('../database');
const meta = require('../meta');

const jobs = {};

function normalizeDigestHour(cfg) {
	let digestHour = cfg && cfg.digestHour;

	// Fix digest hour if invalid
	if (isNaN(digestHour)) {
		return 17;
	}

	digestHour = Number(digestHour);
	if (digestHour > 23 || digestHour < 0) {
		return 0;
	}

	return digestHour;
}

function createDigestJob(User, opts) {
	const { name, cronString, term } = opts;

	jobs[name] = new cronJob(cronString, (async () => {
		winston.verbose(`[user/jobs] Digest job (${name}) started.`);
		try {
			if (name === 'digest.weekly') {
				const counter = await db.increment('biweeklydigestcounter');
				if (counter % 2) {
					await User.digest.execute({ interval: 'biweek' });
				}
			}
			await User.digest.execute({ interval: term });
		} catch (err) {
			winston.error(err.stack);
		}
	}), null, true);
	winston.verbose(`[user/jobs] Starting job (${name})`);
}

module.exports = function (User) {
	User.startJobs = function () {
		winston.verbose('[user/jobs] (Re-)starting jobs...');

		const digestHour = normalizeDigestHour(meta.config);

		User.stopJobs();

		createDigestJob(User, { name: 'digest.daily', cronString: `0 ${digestHour} * * *`, term: 'day' });
		createDigestJob(User, { name: 'digest.weekly', cronString: `0 ${digestHour} * * 0`, term: 'week' });
		createDigestJob(User, { name: 'digest.monthly', cronString: `0 ${digestHour} 1 * *`, term: 'month' });

		jobs['reset.clean'] = new cronJob('0 0 * * *', User.reset.clean, null, true);
		winston.verbose('[user/jobs] Starting job (reset.clean)');

		winston.verbose(`[user/jobs] jobs started`);
	};

	User.stopJobs = function () {
		let terminated = 0;
		// Terminate any active cron jobs
		for (const jobId of Object.keys(jobs)) {
			winston.verbose(`[user/jobs] Terminating job (${jobId})`);
			try {
				jobs[jobId].stop();
			} catch (err) {
				winston.error(`[user/jobs] Error stopping job (${jobId}): ${err.message}`);
			}
			delete jobs[jobId];
			terminated += 1;
		}
		if (terminated > 0) {
			winston.verbose(`[user/jobs] ${terminated} jobs terminated`);
		}
	};
};
