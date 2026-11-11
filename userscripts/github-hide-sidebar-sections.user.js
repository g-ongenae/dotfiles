// ==UserScript==
// @name         GitHub — Hide sidebar sections
// @namespace    https://github.com/g-ongenae/dotfiles
// @author       g-ongenae
// @version      1.1.0
// @description  Hides the Projects, Milestone, Development and Notifications sections of the sidebar of pull requests (the Overview preview and the classic conversation) and issues, leaving the reviewers, assignees, labels and participants.
// @license      MIT
// @homepageURL  https://github.com/g-ongenae/dotfiles/blob/main/userscripts/github-hide-sidebar-sections.user.js
// @supportURL   https://github.com/g-ongenae/dotfiles/issues
// @match        https://github.com/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Settings ----------
  // Sections hidden, by the title of their header
  const SECTIONS = ['Projects', 'Milestone', 'Development', 'Notifications'];

  const HIDE = 'data-ghs-hide';
  const TITLE = new RegExp(`^(${SECTIONS.join('|')})\\b`, 'i');
  // Sidebar sections: pull request Overview (React), classic pull requests (server-rendered) and
  // issues (React)
  const OVERVIEW = '[data-testid="sticky-sidebar"] > section';
  const ITEMS = [
    OVERVIEW,
    '#partial-discussion-sidebar .discussion-sidebar-item',
    '[data-testid^="sidebar-"][data-testid$="-section"]',
  ].join(', ');
  const HEADER = '.discussion-sidebar-heading, .discussion-sidebar-toggle, h2, h3, h4, summary';

  // ---------- Styles ----------
  // Injected at document-start; the sections recognisable without their title never flash
  const style = document.createElement('style');
  style.textContent = `
    [${HIDE}],
    ${SECTIONS.map((s) => `${OVERVIEW}[aria-label="${s}"]`).join(', ')},
    #partial-discussion-sidebar .sidebar-progress-bar,
    #partial-discussion-sidebar .sidebar-notifications,
    [data-testid="sidebar-projects-section"],
    [data-testid="sidebar-milestones-section"],
    [data-testid="sidebar-development-section"] { display: none !important; }
  `;
  (document.head || document.documentElement).appendChild(style);

  // ---------- Hiding ----------
  function hide() {
    for (const item of document.querySelectorAll(ITEMS)) {
      if (item.hasAttribute(HIDE)) continue;
      const title = item.querySelector(HEADER)?.textContent.trim() || '';
      if (TITLE.test(title)) item.setAttribute(HIDE, '');
    }
  }

  // The sidebar is re-rendered when it updates and on navigation between pages
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      hide();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
