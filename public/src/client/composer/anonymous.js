'use strict';

define('composer/anonymous', ['composer/base'], function (baseModule) {
    const anonymous = {};

    anonymous.init = function () {
        const composer = $('[component="composer"]');
        const anonymousToggle = composer.find('#anonymous');

        anonymousToggle.on('change', function () {
            const data = baseModule.getData();
            data.isAnonymous = this.checked ? 1 : 0;
            baseModule.setData(data);
        });
    };

    return anonymous;
});