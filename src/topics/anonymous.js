'use strict';

const db = require('../database');
const user = require('../user');
const posts = require('../posts');
const plugins = require('../plugins');
const meta = require('../meta');
const roles = require('./roles');

const anonymousTopics = module.exports;

anonymousTopics.modifyForAnonymous = async function (topicsData, viewerUID) {
    if (!Array.isArray(topicsData) || !topicsData.length) {
        return;
    }

    const anonymousTopics = topicsData.filter(topic => topic && topic.isAnonymous);
    if (!anonymousTopics.length) {
        return;
    }

    await Promise.all(anonymousTopics.map(async (topic) => {
        const isInstructorOrTA = await roles.isInstructorOrTA(viewerUID, topic.cid);
        if (!isInstructorOrTA) {
            // Replace user data with anonymous info for non-instructors/TAs
            topic.user = {
                ...topic.user,
                username: 'Anonymous Student',
                displayname: 'Anonymous Student',
                userslug: 'anonymous',
                picture: meta.config.defaultAvatar,
            };
        }
    }));
};