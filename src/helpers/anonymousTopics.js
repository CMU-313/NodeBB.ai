'use strict';

const privileges = require('../privileges');
const roles = require('../privileges/roles');

module.exports = function (helpers) {
    helpers.displayTopicAuthor = async function (userData, topicData, viewerUID) {
        if (!topicData || !topicData.isAnonymous) {
            return userData;
        }

        const isInstructorOrTA = await roles.isInstructorOrTA(viewerUID, topicData.cid);
        if (isInstructorOrTA) {
            return userData;
        }

        return {
            ...userData,
            username: 'Anonymous Student',
            displayname: 'Anonymous Student',
            userslug: 'anonymous',
            picture: helpers.defaultAvatar,
        };
    };
};