
'use strict';

const async = require('async');

const db = require('../database');
const user = require('../user');

module.exports = function (Topics) {
    const isValidUid = uid => parseInt(uid, 10) > 0;

    Topics.getUserBookmark = async function (tid, uid) {
        return isValidUid(uid) ? await db.sortedSetScore(`tid:${tid}:bookmarks`, uid) : null;
    };

    Topics.getUserBookmarks = async function (tids, uid) {
        return isValidUid(uid)
            ? await db.sortedSetsScore(tids.map(tid => `tid:${tid}:bookmarks`), uid)
            : tids.map(() => null);
    };

    Topics.setUserBookmark = async function (tid, uid, index) {
        if (isValidUid(uid)) {
            await db.sortedSetAdd(`tid:${tid}:bookmarks`, index, uid);
        }
    };

    Topics.getTopicBookmarks = async function (tid) {
        return await db.getSortedSetRangeWithScores(`tid:${tid}:bookmarks`, 0, -1);
    };

    Topics.updateTopicBookmarks = async function (tid, pids) {
        const maxIndex = await Topics.getPostCount(tid);
        const indices = await db.sortedSetRanks(`tid:${tid}:posts`, pids);
        const postIndices = indices.map(i => (i === null ? 0 : i + 1));
        const minIndex = Math.min(...postIndices);
        const bookmarks = await Topics.getTopicBookmarks(tid);

        const uidData = bookmarks
            .map(b => ({ uid: b.value, bookmark: parseInt(b.score, 10) }))
            .filter(data => data.bookmark >= minIndex);

        await async.eachLimit(uidData, 50, async (data) => {
            const newBookmark = calculateNewBookmark(data.bookmark, postIndices, maxIndex, pids.length);
            const shouldSkip = newBookmark === data.bookmark ||
                (await user.getSettings(data.uid)).topicPostSort === 'most_votes';

            if (!shouldSkip) {
                await Topics.setUserBookmark(tid, data.uid, newBookmark);
            }
        });
    };

    function calculateNewBookmark(bookmark, postIndices, maxIndex, removedCount) {
        const adjusted = postIndices.reduce(
            (acc, i) => (i < bookmark ? acc - 1 : acc),
            Math.min(bookmark, maxIndex)
        );
        return Math.min(adjusted, maxIndex - removedCount);
    }
};