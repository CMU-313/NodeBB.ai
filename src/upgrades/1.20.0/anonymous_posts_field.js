'use strict';

/**
 * Database migration to add anonymous field to existing posts
 * This ensures backward compatibility with existing posts
 */

const db = require('../database');
const batch = require('../batch');

module.exports = {
    name: 'Add anonymous field to posts',
    timestamp: Date.UTC(2024, 11, 12), // December 12, 2024
    method: async function (callback) {
        const { progress } = this;
        
        try {
            console.log('Starting migration: Add anonymous field to posts');
            
            // Add anonymous field to all existing posts (default to 0 = not anonymous)
            await batch.processSortedSet('posts:pid', async (pids) => {
                const bulkOps = pids.map(pid => ({
                    key: `post:${pid}`,
                    data: { anonymous: 0 }
                }));
                
                if (bulkOps.length) {
                    await db.setObjectBulk(bulkOps);
                    progress.incr(bulkOps.length);
                }
            }, {
                progress: progress,
                batch: 500
            });
            
            console.log('Migration completed: Add anonymous field to posts');
            callback();
        } catch (error) {
            console.error('Migration failed:', error);
            callback(error);
        }
    }
};