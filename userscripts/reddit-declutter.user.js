// ==UserScript==
// @name         Reddit — Declutter
// @namespace    https://github.com/g-ongenae/dotfiles
// @author       g-ongenae
// @version      1.0.0
// @description  Hides Reddit's sign-up panel on the left, the right column (related posts, community card, footer links), ads, the "more posts" feed under the comments and Google's sign-in prompt; widens the main column and shows the whole text of a post on its own page.
// @license      MIT
// @homepageURL  https://github.com/g-ongenae/dotfiles/blob/main/userscripts/reddit-declutter.user.js
// @supportURL   https://github.com/g-ongenae/dotfiles/issues
// @match        https://www.reddit.com/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Settings ----------
  // Set any of these to false to keep that part of Reddit.
  const HIDE_SIGNUP_PANEL = true; // "Join the most authentic place on the Web" panel shown logged out
  const HIDE_RIGHT_COLUMN = true; // related posts, community card, footer links
  const HIDE_ADS = true; // promoted posts and the ad slots between comments
  const HIDE_MORE_POSTS = true; // feed of other posts under the comments, community suggestions
  const HIDE_GOOGLE_PROMPT = true; // Google's "Sign in to reddit.com" pop-up
  const EXPAND_POST = true; // whole text of a post on its own page, without "Read more"

  // The left column holds the sign-up panel when logged out and the navigation (Home, communities…)
  // when logged in: only the first is hidden, and its room in the page grid is given back.
  const SIGNUP_BANNER = '[noun="static_left_rail_banner"]';
  const SIGNUP_PANEL = `#left-sidebar-container:has(${SIGNUP_BANNER})`;
  const POST_BODY = 'shreddit-post-text-body[view-context="CommentsPage"]';

  // ---------- Styles ----------
  // Injected at document-start so nothing flashes before being hidden; Reddit swaps pages without
  // reloading, and the rules apply to each new one as it is rendered.
  const HIDDEN = [
    ...(HIDE_SIGNUP_PANEL ? [SIGNUP_PANEL] : []),
    ...(HIDE_RIGHT_COLUMN ? ['#right-sidebar-container'] : []),
    ...(HIDE_ADS
      ? [
          'shreddit-ad-post',
          'shreddit-sidebar-ad',
          'shreddit-comments-page-ad',
          'shreddit-comment-tree-ad',
          '.promotedlink',
        ]
      : []),
    ...(HIDE_MORE_POSTS ? ['#mosaic-pdp-feed', '[slot="related-community-recommendation"]'] : []),
    ...(HIDE_GOOGLE_PROMPT ? ['auth-flow-google-one-tap-prompt', '#credential_picker_container'] : []),
    ...(EXPAND_POST ? [`${POST_BODY} .read-more-overflow-cover`, `${POST_BODY} [id$="-read-more-button"]`] : []),
  ];

  const style = document.createElement('style');
  style.textContent = `
    ${HIDDEN.join(',\n    ')} { display: none !important; }
    ${HIDE_SIGNUP_PANEL ? `.grid-container:has(> #left-sidebar-container ${SIGNUP_BANNER}) { --flex-nav-width: 0px !important; }` : ''}
    ${HIDE_RIGHT_COLUMN ? '.main-container:has(> #right-sidebar-container) { grid-template-columns: minmax(0, 1fr) !important; }' : ''}
    ${EXPAND_POST ? `${POST_BODY} [id$="-post-rtjson-content"] { max-height: none !important; }` : ''}
  `;
  (document.head || document.documentElement).appendChild(style);
})();
