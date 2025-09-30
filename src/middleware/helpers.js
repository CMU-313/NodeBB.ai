'use strict';

const winston = require('winston');
const validator = require('validator');
const slugify = require('../slugify');

const meta = require('../meta');

const helpers = module.exports;

helpers.try = function (middleware) {
	if (middleware && middleware.constructor && middleware.constructor.name === 'AsyncFunction') {
		return async function (req, res, next) {
			try {
				await middleware(req, res, next);
			} catch (err) {
				next(err);
			}
		};
	}
	return function (req, res, next) {
		try {
			middleware(req, res, next);
		} catch (err) {
			next(err);
		}
	};
};

helpers.buildBodyClass = function (req, res, templateData = {}) {
	const parts = [];
	
	// Process URL path parts
	parts.push(...helpers._processUrlParts(req.path));
	
	// Add template-specific classes
	helpers._addTemplateClasses(parts, templateData);
	
	// Add breadcrumb classes
	helpers._addBreadcrumbClasses(parts, templateData);
	
	// Add custom body classes
	helpers._addCustomBodyClasses(parts, templateData);
	
	// Add status and theme classes
	helpers._addStatusAndThemeClasses(parts, res);
	
	// Add user authentication class
	helpers._addUserAuthClass(parts, req);
	
	return parts.join(' ');
};

helpers._processUrlParts = function (path) {
	const clean = path.replace(/^\/api/, '').replace(/^\/|\/$/g, '');
	const parts = clean.split('/').slice(0, 3);
	
	return parts.map((p, index) => helpers._processUrlPart(p, index, parts[0]));
};

helpers._processUrlPart = function (part, index, firstPart) {
	let processedPart = part;
	
	try {
		processedPart = slugify(decodeURIComponent(part));
	} catch (err) {
		winston.error(`Error decoding URI: ${part}`);
		winston.error(err.stack);
		processedPart = '';
	}
	
	processedPart = validator.escape(String(processedPart));
	return index ? `${firstPart}-${processedPart}` : `page-${processedPart || 'home'}`;
};

helpers._addTemplateClasses = function (parts, templateData) {
	const { template } = templateData;
	
	if (!template) return;
	
	parts.push(`template-${template.name.split('/').join('-')}`);
	
	if (template.topic) {
		parts.push(`page-topic-category-${templateData.category.cid}`);
		parts.push(`page-topic-category-${slugify(templateData.category.name)}`);
	}
	
	if (template.chats && templateData.roomId) {
		parts.push(`page-user-chats-${templateData.roomId}`);
	}
};

helpers._addBreadcrumbClasses = function (parts, templateData) {
	if (!Array.isArray(templateData.breadcrumbs)) return;
	
	templateData.breadcrumbs.forEach((crumb) => {
		if (crumb && crumb.hasOwnProperty('cid')) {
			parts.push(`parent-category-${crumb.cid}`);
		}
	});
};

helpers._addCustomBodyClasses = function (parts, templateData) {
	if (templateData && templateData.bodyClasses) {
		parts.push(...templateData.bodyClasses);
	}
};

helpers._addStatusAndThemeClasses = function (parts, res) {
	parts.push(`page-status-${res.statusCode}`);
	parts.push(`theme-${(meta.config['theme:id'] || '').split('-')[2]}`);
};

helpers._addUserAuthClass = function (parts, req) {
	parts.push(req.loggedIn ? 'user-loggedin' : 'user-guest');
};
