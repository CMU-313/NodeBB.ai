/* global define, socket, app, bootbox */
(function () {
  'use strict';

  define('nodebb-plugin-office-hours-voice/client', ['jquery', 'bootstrap'], function ($) {
    const NAME = 'nodebb-plugin-office-hours-voice';

    function openModal(room, provider) {
      const url = provider.replace(/\/$/, '') + '/' + encodeURIComponent(room);

      const $iframe = $('<iframe/>', {
        src: url,
        id: 'oh-voice-iframe',
        frameborder: 0,
        width: '100%',
        height: '480px',
        allow: 'camera; microphone; fullscreen; display-capture'
      });

      const $content = $('<div/>').append($iframe).append(
        $('<p/>', { text: 'If the room fails to load, you can open it in a new tab.' }).append(
          ' ',
          $('<a/>', { href: url, target: '_blank', text: 'Open in new tab' })
        )
      );

      bootbox.dialog({
        title: 'Join Office Hours (Voice)',
        message: $content,
        size: 'large',
        buttons: {
          close: {
            label: 'Close',
            className: 'btn-default'
          }
        }
      });
    }

    function init() {
      const room = 'nodebb-office-hours';
      const provider = 'https://meet.jit.si';

      // Floating button
      const $btn = $('<button/>', {
        id: 'oh-voice-join-btn',
        class: 'btn btn-primary',
        title: 'Join Office Hours (Voice)'
      }).css({
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 2000
      }).html('<i class="fa fa-headphones" aria-hidden="true"></i> Join OH');

      $btn.on('click', function () {
        openModal(room, provider);
      });

      // Sidebar button injection (robust): try to append to #main-nav or first nav ul
      function injectSidebarLink() {
        // avoid duplicate
        if ($('#oh-sidebar-link-item').length) {
          return;
        }

        const $mainNav = $('#main-nav');
        const $container = $mainNav.length ? $mainNav : $('nav.sidebar, .sidebar').find('ul').first();
        if (!$container || !$container.length) {
          return;
        }

        const $link = $('<a/>', {
          href: '/office-hours/queue',
          class: 'nav-link navigation-link d-flex gap-2 align-items-center oh-sidebar-link',
          title: 'Office Hours Queue'
        }).append($('<span/>', { class: 'd-flex gap-2 align-items-center text-nowrap truncate-open' }).append(
          $('<span/>', { class: 'position-relative' }).append($('<i/>', { class: 'fa fa-fw fa-users' }))
        )).append($('<span/>', { class: 'nav-text small visible-open fw-semibold text-truncate', text: 'Office Hours' }));

        const $item = $('<li/>', { id: 'oh-sidebar-link-item', class: 'nav-item mx-2' }).append($link);
        $container.append($item);
      }

      // initial inject and re-inject after ajaxify (theme may re-render sidebar)
      injectSidebarLink();
      // Re-inject after navigation changes
      require(['hooks'], function (hooks) {
        hooks.on('action:ajaxify.end', function () {
          injectSidebarLink();
        });
      });

      $btn.on('click', function () {
        openModal(room, provider);
      });

      $('body').append($btn);

      // Hook inline join button on the standalone page
      $(document).on('click', '#oh-voice-join-inline', function (e) {
        e.preventDefault();
        openModal(room, provider);
      });
    }

    return {
      init: init
    };
  });

  // Register with NodeBB when page loads
  require(['hooks'], function (hooks) {
    hooks.on('action:app.load', function () {
      require(['nodebb-plugin-office-hours-voice/client'], function (mod) {
        mod.init();
      });
    });
  });
}());
