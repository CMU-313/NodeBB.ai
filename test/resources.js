'use strict';

const assert = require('assert');
const db = require('./mocks/databasemock');
const Resources = require('../src/resources');

describe('Resources', () => {
	let testResource;

	before((done) => {
		testResource = {
			resourceName: 'Test Resource',
			resourceDescription: 'This is a test resource',
			resourceLink: 'https://example.com/resource',
			createdBy: 1,
		};
		done();
	});

	describe('.create()', () => {
		it('should create a resource with valid data', async () => {
			const resource = await Resources.create(testResource);
			assert(resource);
			assert.equal(typeof resource.resourceId, 'string');
			assert.equal(resource.resourceName, testResource.resourceName);
			assert.equal(resource.resourceDescription, testResource.resourceDescription);
			assert.equal(resource.resourceLink, testResource.resourceLink);
			assert(resource.createdAt > 0);
			assert(resource.updatedAt > 0);
		});

		it('should fail to create a resource with invalid data', async () => {
			const invalidResource = {
				resourceName: '', // Invalid: empty name
				resourceDescription: 'Test description',
				resourceLink: 'not-a-url', // Invalid: not a URL
				createdBy: 'invalid', // Invalid: not a number
			};

			try {
				await Resources.create(invalidResource);
				assert(false, 'Should have thrown an error');
			} catch (err) {
				assert(err);
				assert(err.message.includes('Invalid resource data'));
			}
		});
	});

	describe('.get()', () => {
		let resourceId;

		before(async () => {
			const resource = await Resources.create(testResource);
			resourceId = resource.resourceId;
		});

		it('should get a resource by id', async () => {
			const resource = await Resources.get(resourceId);
			assert(resource);
			assert.equal(resource.resourceId, resourceId);
			assert.equal(resource.resourceName, testResource.resourceName);
		});

		it('should fail to get a non-existent resource', async () => {
			const resource = await Resources.get('resource:999999');
			assert(!resource);
		});

		it('should fail with invalid resource id', async () => {
			try {
				await Resources.get('');
				assert(false, 'Should have thrown an error');
			} catch (err) {
				assert(err);
				assert.equal(err.message, 'Invalid resource ID');
			}
		});
	});

	describe('.update()', () => {
		let resourceId;

		before(async () => {
			const resource = await Resources.create(testResource);
			resourceId = resource.resourceId;
		});

		it('should update a resource with valid data', async () => {
			const updateData = {
				resourceName: 'Updated Resource Name',
				resourceDescription: 'Updated description',
			};

			const updated = await Resources.update(resourceId, updateData);
			assert(updated);
			assert.equal(updated.resourceName, updateData.resourceName);
			assert.equal(updated.resourceDescription, updateData.resourceDescription);
			assert(updated.updatedAt > updated.createdAt);
		});

		it('should fail to update with invalid data', async () => {
			try {
				await Resources.update(resourceId, { resourceName: '' });
				assert(false, 'Should have thrown an error');
			} catch (err) {
				assert(err);
				assert(err.message.includes('Invalid resource data'));
			}
		});

		it('should fail to update non-existent resource', async () => {
			try {
				await Resources.update('resource:999999', { resourceName: 'Test' });
				assert(false, 'Should have thrown an error');
			} catch (err) {
				assert(err);
				assert.equal(err.message, 'Resource not found');
			}
		});
	});

	describe('.delete()', () => {
		let resourceId;

		before(async () => {
			const resource = await Resources.create(testResource);
			resourceId = resource.resourceId;
		});

		it('should delete a resource', async () => {
			await Resources.delete(resourceId);
			const resource = await Resources.get(resourceId);
			assert(!resource);
		});

		it('should fail with invalid resource id', async () => {
			try {
				await Resources.delete('');
				assert(false, 'Should have thrown an error');
			} catch (err) {
				assert(err);
				assert.equal(err.message, 'Invalid resource ID');
			}
		});
	});

	describe('.getAll()', () => {
		before(async () => {
			// Create multiple test resources
			await Resources.create({
				...testResource,
				resourceName: 'Resource 1',
			});
			await Resources.create({
				...testResource,
				resourceName: 'Resource 2',
			});
		});

		it('should get all resources', async () => {
			const resources = await Resources.getAll();
			assert(Array.isArray(resources));
			assert(resources.length >= 2);
			resources.forEach((resource) => {
				assert(resource.resourceId);
				assert(resource.resourceName);
				assert(resource.resourceDescription);
				assert(resource.resourceLink);
			});
		});
	});
});