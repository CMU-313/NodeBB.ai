'use strict';

const db = require('../../database');

module.exports = {
    name: 'Add isAnonymous flag to topics',
    timestamp: Date.UTC(2025, 8, 30),
    method: async function () {
        const batch = require('../../batch');
        await batch.processSortedSet('topics:tid', async (tids) => {
            await db.setObjectBulk(
                tids.map(tid => ['topic:' + tid, { isAnonymous: 0 }])
            );
        }, {
            batch: 500,
        });
    },
};