// ==UserScript==
// @name         Slack — Declutter
// @namespace    https://github.com/g-ongenae/dotfiles
// @author       g-ongenae
// @version      1.1.1
// @description  Hides the "Find a conversation" filter, the Huddles, Later/Saved and Directories entries of the sidebar, and the Help button of the top bar; folds image and file previews in messages by default.
// @license      MIT
// @homepageURL  https://github.com/g-ongenae/dotfiles/blob/main/userscripts/slack-declutter.user.js
// @supportURL   https://github.com/g-ongenae/dotfiles/issues
// @match        https://app.slack.com/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Settings ----------
  // Set any of these to false to keep that part of Slack.
  const HIDE_FIND_CONVERSATION = true; // "Trouver une conversation…" filter above the sidebar
  const HIDE_HUDDLES = true; // "Appels d'équipe"
  const HIDE_SAVED = true; // "Enregistré" (Later)
  const HIDE_DIRECTORIES = true; // "Répertoires"
  const HIDE_HELP = true; // "?" button at the right of the top bar
  // Fold image/file previews in messages to their file name; Slack's own caret unfolds them.
  const FOLD_FILES = true;

  // Sidebar rows, by their data-item-key (the same whatever Slack's language)
  const SIDEBAR_KEYS = [
    ...(HIDE_HUDDLES ? ['Pbrowse-huddles'] : []),
    ...(HIDE_SAVED ? ['Pbookmarks'] : []),
    ...(HIDE_DIRECTORIES ? ['unified_directory'] : []),
  ];
  const SIDEBAR_ROWS = SIDEBAR_KEYS.map((k) => `.c-virtual_list__item[data-item-key="${k}"]`).join(', ');
  const HIDDEN = [
    SIDEBAR_ROWS,
    HIDE_FIND_CONVERSATION ? '.p-sidebar_text_filter_input_header:has([data-qa="sidebar-text-filter-input"])' : '',
    HIDE_HELP ? '[data-qa="top-nav-help-button"]' : '',
  ].filter(Boolean).join(', ');

  const SHIFT = 'data-sdc-shift'; // sidebar row moved up over the hidden rows above it

  // ---------- Styles ----------
  // Injected at document-start so nothing flashes before being hidden
  const style = document.createElement('style');
  style.textContent = `
    ${HIDDEN ? `${HIDDEN} { display: none !important; }` : ''}
    [${SHIFT}] { margin-top: calc(-1px * var(--sdc-shift, 0)) !important; }
  `;
  (document.head || document.documentElement).appendChild(style);

  // ---------- Sidebar gaps ----------
  // The sidebar is a virtual list of absolutely positioned rows (inline translateY + height):
  // hiding one leaves a hole, so the rows below are moved up by the height of the hidden rows above.
  const rowY = (row) => parseFloat(/translateY\(([-\d.]+)px\)/.exec(row.style.transform)?.[1]) || 0;

  function closeSidebarGaps() {
    if (!SIDEBAR_ROWS) return;
    const lists = new Set([...document.querySelectorAll(SIDEBAR_ROWS)].map((r) => r.parentElement));
    for (const list of lists) {
      const rows = [...list.children].filter((r) => r.classList.contains('c-virtual_list__item'));
      const hidden = rows
        .filter((r) => r.matches(SIDEBAR_ROWS))
        .map((r) => ({ y: rowY(r), height: parseFloat(r.style.height) || 0 }));
      for (const row of rows) {
        if (row.matches(SIDEBAR_ROWS)) continue;
        const y = rowY(row);
        const shift = hidden.reduce((sum, h) => (h.y < y ? sum + h.height : sum), 0);
        // Only write on change: the observer watches style attributes
        if (String(shift) === row.style.getPropertyValue('--sdc-shift')) continue;
        row.style.setProperty('--sdc-shift', String(shift));
        row.toggleAttribute(SHIFT, shift > 0);
      }
    }
  }

  // ---------- Folded file previews ----------
  // Each preview is folded once; unfolding it by hand sticks, even when Slack re-renders it.
  const folded = new Set();

  function foldFiles() {
    if (!FOLD_FILES) return;
    for (const btn of document.querySelectorAll('[data-qa="file-collapse-button"][aria-expanded="true"]')) {
      const message = btn.closest('[data-item-key]');
      const name = btn.closest('.c-message_kit__file')?.querySelector('[data-qa="file_name"]')?.textContent;
      const key = `${message?.dataset.itemKey}|${name}`;
      if (folded.has(key)) continue;
      folded.add(key);
      btn.click();
    }
  }

  // ---------- Main pass (Slack is a single-page app) ----------
  function run() {
    closeSidebarGaps();
    foldFiles();
  }

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; run(); });
  }).observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'aria-expanded'],
  });
})();
