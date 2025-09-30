'use strict';

const groups = require('../groups');
const user = require('../user');
const plugins = require('../plugins');

const roles = module.exports;

roles.isInstructorOrTA = async function (uid, cid) {
    if (!uid) {
        return false;
    }
    
    const groupNames = await groups.getUserGroupMembership('groups:visible:createtime', [uid]);
    const userGroups = groupNames[0];
    
    const isInstructor = userGroups.includes('instructors');
    const isTA = userGroups.includes('teaching-assistants');
    
    const result = await plugins.hooks.fire('filter:privileges.isInstructorOrTA', {
        uid: uid,
        cid: cid,
        isInstructorOrTA: isInstructor || isTA,
    });
    
    return result.isInstructorOrTA;
};