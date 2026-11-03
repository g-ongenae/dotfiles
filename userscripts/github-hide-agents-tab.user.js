// ==UserScript==
// @name         GitHub — Hide the Agents tab
// @namespace    https://github.com/g-ongenae/dotfiles
// @version      1.0.0
// @description  Hides the "Agents" tab of the repository navigation bar, and its entry in the overflow menu shown on narrow windows.
// @match        https://github.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // The tab links to /<owner>/<repo>/agents; matched by its link and id, whatever GitHub's language,
  // in the navigation bar and in the "…" overflow menu that holds the tabs not fitting the window
  const TAB = ':is(a[href$="/agents"], a[href*="/agents?"], #agents-tab)';
  const HIDDEN = [
    `nav[aria-label="Repository"] ${TAB}`,
    `nav[aria-label="Repository"] li:has(> ${TAB})`,
    '.js-responsive-underlinenav [data-menu-item$="agents-tab"]',
    `[role="menu"] :is(li, [role="menuitem"]):has(> ${TAB})`,
  ].join(', ');

  // ---------- Styles ----------
  // Injected at document-start so the tab never flashes
  const style = document.createElement('style');
  style.textContent = `
    ${HIDDEN} { display: none !important; }
  `;
  (document.head || document.documentElement).appendChild(style);
})();
