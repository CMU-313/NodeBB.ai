"use strict";

define('forum/compose-private', ['hooks', 'translator', 'app'], function (hooks, translator) {
    const ComposePrivate = {};

    hooks.on('action:composer.enhance', function (data) {
        const container = data && data.container ? data.container : $('.composer');
        if (!container || !container.length) {
            return;
        }

        // Only show the private controls if server indicated the user can make private topics.
        const canMakePrivate = ajaxify && ajaxify.data && ajaxify.data.canMakePrivate;
        if (!canMakePrivate) {
            return;
        }

        const additional = container.find('.additional-options');
        const target = additional.length ? additional : container;

        // Build UI elements
        const privateRow = $(
            '<div class="compose-private-row form-group">' +
            '  <label><input type="checkbox" name="private" value="1"> [[topic:composer.private-label|Private]]</label>' +
            '  <div class="help-block">[[topic:composer.private-help|Only selected groups will be able to view this topic.]]</div>' +
            '</div>'
        );

        const groupsRow = $(
            '<div class="compose-allowed-groups form-group">' +
            '  <label>[[topic:composer.allowed-groups|Allowed groups (comma-separated)]]</label>' +
            '  <input type="text" class="form-control" name="allowedGroups" placeholder="TA, Professors"/>' +
            '</div>'
        );

        target.append(privateRow);
        target.append(groupsRow);

        // Toggle groups input visibility when checkbox changes
        privateRow.find('input[name="private"]').on('change', function () {
            const checked = $(this).is(':checked');
            groupsRow.toggle(checked);
        }).trigger('change');
    });

    return ComposePrivate;
});
