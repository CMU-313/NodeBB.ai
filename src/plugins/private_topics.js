"use strict";

const plugins = require('../plugins');
const privileges = require('../privileges');

module.exports = function (Plugins) {
    // Expose a composer build filter so we can show a "Private" option to users
    // who are allowed to create private topics in a given category (admins/mods).
    plugins.hooks.register('core', {
        hook: 'filter:composer.build',
        method: async (data) => {
            try {
                const { req } = data;
                data.templateData = data.templateData || {};

                // Default: don't show the private option
                data.templateData.canMakePrivate = false;

                if (!req || !req.uid) {
                    return data;
                }

                // If a category is provided, check category-level admin/mod privileges
                const cid = parseInt(req.query && req.query.cid, 10) || (data.templateData.cid ? parseInt(data.templateData.cid, 10) : 0);
                if (cid) {
                    const isAdminOrMod = await privileges.categories.isAdminOrMod(cid, req.uid);
                    data.templateData.canMakePrivate = !!isAdminOrMod;
                }

                return data;
            } catch (err) {
                return data;
            }
        },
    });
};
