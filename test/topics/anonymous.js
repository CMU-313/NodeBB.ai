'use strict';

const assert = require('assert');
const async = require('async');
const request = require('request');
const nconf = require('nconf');

const db = require('../src/database');
const topics = require('../src/topics');
const categories = require('../src/categories');
const groups = require('../src/groups');
const user = require('../src/user');
const roles = require('../src/privileges/roles');

describe('Anonymous Topics', () => {
    let cid;
    let tid;
    let adminUid;
    let instructorUid;
    let studentUid;
    let anonymousPost;

    before(async () => {
        // Create category
        const category = await categories.create({
            name: 'Test Category',
            description: 'Test category for anonymous posts',
        });
        cid = category.cid;

        // Create users
        [adminUid, instructorUid, studentUid] = await Promise.all([
            user.create({ username: 'admin', password: 'adminpwd' }),
            user.create({ username: 'instructor', password: 'instructorpwd' }),
            user.create({ username: 'student', password: 'studentpwd' }),
        ]);

        // Set up roles
        await Promise.all([
            groups.join('administrators', adminUid),
            groups.join('instructors', instructorUid),
        ]);

        // Create an anonymous topic
        anonymousPost = await topics.post({
            uid: studentUid,
            cid: cid,
            title: 'Anonymous Test Topic',
            content: 'This is an anonymous test topic.',
            isAnonymous: 1,
        });
        tid = anonymousPost.topicData.tid;
    });

    describe('Creating anonymous topics', () => {
        it('should create a topic with isAnonymous flag set', async () => {
            const topicData = await topics.getTopicData(tid);
            assert(topicData);
            assert.strictEqual(topicData.isAnonymous, 1);
        });

        it('should show real author to instructors', async () => {
            const data = await topics.getTopicWithPosts(tid, `tid:${tid}:posts`, instructorUid, 0, 19, false);
            assert.strictEqual(data.posts[0].user.username, 'student');
        });

        it('should show anonymous author to other students', async () => {
            const otherStudentUid = await user.create({ username: 'student2', password: 'student2pwd' });
            const data = await topics.getTopicWithPosts(tid, `tid:${tid}:posts`, otherStudentUid, 0, 19, false);
            assert.strictEqual(data.posts[0].user.username, 'Anonymous Student');
        });

        it('should allow students to post anonymously', async () => {
            const newTopic = await topics.post({
                uid: studentUid,
                cid: cid,
                title: 'Another Anonymous Topic',
                content: 'This is another anonymous topic.',
                isAnonymous: 1,
            });
            assert(newTopic);
            assert.strictEqual(newTopic.topicData.isAnonymous, 1);
        });
    });

    describe('Role checking', () => {
        it('should identify instructors correctly', async () => {
            const isInstructor = await roles.isInstructorOrTA(instructorUid, cid);
            assert(isInstructor);
        });

        it('should not identify students as instructors', async () => {
            const isInstructor = await roles.isInstructorOrTA(studentUid, cid);
            assert(!isInstructor);
        });
    });

    describe('Anonymous topic display', () => {
        it('should show anonymous label in topic list', async () => {
            const data = await topics.getTopicsByTids([tid], studentUid);
            assert.strictEqual(data[0].user.username, 'Anonymous Student');
        });

        it('should preserve anonymous status after edits', async () => {
            await topics.setTopicField(tid, 'title', 'Updated Anonymous Topic');
            const topicData = await topics.getTopicData(tid);
            assert.strictEqual(topicData.isAnonymous, 1);
        });
    });

    after(async () => {
        await Promise.all([
            topics.purge(tid),
            user.delete(adminUid),
            user.delete(instructorUid),
            user.delete(studentUid),
            categories.purge(cid),
        ]);
    });
});