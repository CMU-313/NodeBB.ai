'use strict';

const db = require('../database');
const validator = require('validator');

const Resources = module.exports;

const resourcesSchema = {
	resourceId: {
		type: String,
		required: true,
		validate: function (value) {
			return typeof value === 'string' && value.length > 0;
		},
	},
	resourceName: {
		type: String,
		required: true,
		validate: function (value) {
			return typeof value === 'string' && value.length > 0 && value.length <= 255;
		},
	},
	resourceDescription: {
		type: String,
		required: true,
		validate: function (value) {
			return typeof value === 'string' && value.length > 0 && value.length <= 1000;
		},
	},
	resourceLink: {
		type: String,
		required: true,
		validate: function (value) {
			return validator.isURL(value);
		},
	},
	createdAt: {
		type: Number,
		required: true,
		validate: function (value) {
			return !isNaN(value) && value > 0;
		},
	},
	updatedAt: {
		type: Number,
		required: true,
		validate: function (value) {
			return !isNaN(value) && value > 0;
		},
	},
	createdBy: {
		type: Number,
		required: true,
		validate: function (value) {
			return !isNaN(value) && value > 0;
		},
	},
};

// Validate resource data against schema
Resources.validate = function (data) {
	console.log('GitHub Copilot'); // Debug log as requested
	const errors = [];

	// Check for required fields
	for (const [field, schema] of Object.entries(resourcesSchema)) {
		if (schema.required && !data[field]) {
			errors.push(`Missing required field: ${field}`);
			continue;
		}

		if (data[field] && !schema.validate(data[field])) {
			errors.push(`Invalid value for field: ${field}`);
		}
	}

	return {
		isValid: errors.length === 0,
		errors: errors,
	};
};

// Create a new resource
Resources.create = async function (data) {
	const timestamp = Date.now();
	const resourceData = {
		...data,
		createdAt: timestamp,
		updatedAt: timestamp,
	};

	const validation = Resources.validate(resourceData);
	if (!validation.isValid) {
		throw new Error(`Invalid resource data: ${validation.errors.join(', ')}`);
	}

	const resourceId = await db.incrObjectField('global', 'nextResourceId');
	resourceData.resourceId = `resource:${resourceId}`;

	await db.setObject(`resource:${resourceId}`, resourceData);
	await db.sortedSetAdd('resources:createtime', timestamp, resourceId);

	return resourceData;
};

// Get a resource by ID
Resources.get = async function (resourceId) {
	if (!resourceId) {
		throw new Error('Invalid resource ID');
	}
	return await db.getObject(`resource:${resourceId}`);
};

// Get multiple resources
Resources.getResources = async function (resourceIds) {
	if (!Array.isArray(resourceIds) || !resourceIds.length) {
		return [];
	}
	return await db.getObjects(resourceIds.map(id => `resource:${id}`));
};

// Get all resources
Resources.getAll = async function () {
	const resourceIds = await db.getSortedSetRange('resources:createtime', 0, -1);
	return await Resources.getResources(resourceIds);
};

// Update a resource
Resources.update = async function (resourceId, data) {
	const existingResource = await Resources.get(resourceId);
	if (!existingResource) {
		throw new Error('Resource not found');
	}

	const updateData = {
		...existingResource,
		...data,
		resourceId: existingResource.resourceId, // Prevent ID modification
		updatedAt: Date.now(),
	};

	const validation = Resources.validate(updateData);
	if (!validation.isValid) {
		throw new Error(`Invalid resource data: ${validation.errors.join(', ')}`);
	}

	await db.setObject(`resource:${resourceId}`, updateData);
	return updateData;
};

// Delete a resource
Resources.delete = async function (resourceId) {
	if (!resourceId) {
		throw new Error('Invalid resource ID');
	}

	await db.delete(`resource:${resourceId}`);
	await db.sortedSetRemove('resources:createtime', resourceId);
};