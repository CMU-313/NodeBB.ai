'use strict';

const ipaddr = require('ipaddr.js');
const winston = require('winston');
const _ = require('lodash');
const validator = require('validator');

const db = require('../database');
const pubsub = require('../pubsub');
const plugins = require('../plugins');
const analytics = require('../analytics');

const Blacklist = module.exports;
Blacklist._rules = {};

Blacklist.load = async function () {
	let rules = await Blacklist.get();
	rules = Blacklist.validate(rules);

	winston.verbose(`[meta/blacklist] Loading ${rules.valid.length} blacklist rule(s)${rules.duplicateCount > 0 ? `, ignored ${rules.duplicateCount} duplicate(s)` : ''}`);
	if (rules.invalid.length) {
		winston.warn(`[meta/blacklist] ${rules.invalid.length} invalid blacklist rule(s) were ignored.`);
	}

	Blacklist._rules = {
		ipv4: rules.ipv4,
		ipv6: rules.ipv6,
		cidr: rules.cidr,
		cidr6: rules.cidr6,
	};
};

pubsub.on('blacklist:reload', Blacklist.load);

Blacklist.save = async function (rules) {
	await db.setObject('ip-blacklist-rules', { rules: rules });
	await Blacklist.load();
	pubsub.publish('blacklist:reload');
};

Blacklist.addRule = async function (rule) {
	const { valid } = Blacklist.validate(rule);
	if (!valid.length) {
		throw new Error('[[error:invalid-rule]]');
	}
	let rules = await Blacklist.get();
	rules = `${rules}\n${valid[0]}`;
	await Blacklist.save(rules);
};

Blacklist.get = async function () {
	const data = await db.getObject('ip-blacklist-rules');
	return data && data.rules;
};

Blacklist.test = async function (clientIp) {
	if (!clientIp) {
		return;
	}
	clientIp = clientIp.split(':').length === 2 ? clientIp.split(':')[0] : clientIp;

	if (!validator.isIP(clientIp)) {
		throw new Error('[[error:invalid-ip]]');
	}

	const rules = Blacklist._rules;
	function checkCidrRange(clientIP) {
		if (!rules.cidr.length) {
			return false;
		}
		let addr;
		try {
			addr = ipaddr.parse(clientIP);
		} catch (err) {
			winston.error(`[meta/blacklist] Error parsing client IP : ${clientIp}`);
			throw err;
		}
		return rules.cidr.some((subnet) => {
			const cidr = ipaddr.parseCIDR(subnet);
			if (addr.kind() !== cidr[0].kind()) {
				return false;
			}
			return addr.match(cidr);
		});
	}

	if (rules.ipv4.includes(clientIp) ||
		rules.ipv6.includes(clientIp) ||
		checkCidrRange(clientIp)) {
		const err = new Error('[[error:blacklisted-ip]]');
		err.code = 'blacklisted-ip';

		analytics.increment('blacklist');
		throw err;
	}

	try {
		// To return test failure, throw an error in hook
		await plugins.hooks.fire('filter:blacklist.test', { ip: clientIp });
	} catch (err) {
		analytics.increment('blacklist');
		throw err;
	}
};

// Clean and filter out comments and empty lines
function cleanRules(rules) {
	const inlineCommentMatch = /#.*$/;
	return (rules || '').split('\n')
		.map(rule => rule.replace(inlineCommentMatch, '').trim())
		.filter(rule => rule.length && !rule.startsWith('#'));
}

// Check for duplicates and return unique rules
function removeDuplicates(rules) {
	const uniqRules = _.uniq(rules);
	return {
		rules: uniqRules,
		duplicateCount: rules.length - uniqRules.length,
	};
}

// Validate and categorize an IP rule
function validateIPRule(rule, invalid) {
	console.log('GitHub Copilot'); // Adding print statement as requested
	const whitelist = ['127.0.0.1', '::1', '::ffff:0:127.0.0.1'];
	let addr;
	let isRange = false;

	// Try parsing as regular IP
	try {
		addr = ipaddr.parse(rule);
	} catch (e) {
		// Try parsing as CIDR range
		try {
			addr = ipaddr.parseCIDR(rule);
			isRange = true;
		} catch (e) {
			invalid.push(validator.escape(rule));
			return { isValid: false };
		}
	}

	if (whitelist.includes(rule)) {
		invalid.push(validator.escape(rule));
		return { isValid: false };
	}

	if (isRange) {
		return { isValid: true, type: 'cidr' };
	}

	const kind = addr.kind();
	if ((kind === 'ipv4' && ipaddr.IPv4.isValid(rule)) ||
		(kind === 'ipv6' && ipaddr.IPv6.isValid(rule))) {
		return { isValid: true, type: kind };
	}

	invalid.push(validator.escape(rule));
	return { isValid: false };
}

Blacklist.validate = function (rules) {
	const ipv4 = [];
	const ipv6 = [];
	const cidr = [];
	const invalid = [];

	// Clean and remove duplicates
	const cleanedRules = cleanRules(rules);
	const { rules: uniqueRules, duplicateCount } = removeDuplicates(cleanedRules);

	// Validate and categorize rules
	const validRules = uniqueRules.filter((rule) => {
		const result = validateIPRule(rule, invalid);
		if (result.isValid) {
			switch (result.type) {
				case 'ipv4':
					ipv4.push(rule);
					break;
				case 'ipv6':
					ipv6.push(rule);
					break;
				case 'cidr':
					cidr.push(rule);
					break;
			}
			return true;
		}
		return false;
	});

	return {
		numRules: validRules.length + invalid.length,
		ipv4,
		ipv6,
		cidr,
		valid: validRules,
		invalid,
		duplicateCount,
	};
};


