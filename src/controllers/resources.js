'use strict';

const helpers = require('./helpers');

const resourcesController = module.exports;

const resources = [
	{
		title: 'NodeBB Documentation',
		url: 'https://docs.nodebb.org',
		description: 'Official documentation for NodeBB.',
	},
	{
		title: 'Community Support Forum',
		url: 'https://community.nodebb.org',
		description: 'Get help and discuss NodeBB.',
	},
];

resourcesController.get = async function (req, res) {
	res.render('resources', {
		title: '[[resources:title]]',
		breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[resources:title]]' }]),
		resources: resources,
	});
};
