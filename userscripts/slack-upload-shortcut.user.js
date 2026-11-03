// ==UserScript==
// @name         Slack — Upload shortcut
// @namespace    https://github.com/g-ongenae/dotfiles
// @author       g-ongenae
// @version      1.2.0
// @description  Cmd+U (Ctrl+U off macOS) opens the file picker of the message composer, like "Upload from your computer" in its "+" menu. It only fires from a composer or the conversation, not from the search box or other inputs.
// @match        https://app.slack.com/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Settings ----------
  // Modifier held with U: 'auto' (Cmd on macOS, Ctrl elsewhere), 'meta' (Cmd/Windows key) or 'ctrl'
  const MODIFIER = 'auto';

  // Each composer (channel, thread, …) holds a hidden file input next to its "+" (Attach) button;
  // clicking it opens the system file picker and Slack uploads the files picked.
  const FILE_INPUT = 'input[type="file"][data-qa="file_upload"]';
  const COMPOSER = '.c-wysiwyg_container';
  const ATTACH_BUTTON = '[data-qa^="shortcuts_menu_trigger__"]';
  const UPLOAD_ITEM = '[data-qa="upload-from-your-computer"]';

  const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
  // How long the "+" menu gets to render its upload item
  const MENU_TIMEOUT = 1000;

  // The composer being typed in, else the one of the conversation; null when the focus is in
  // another input (search box, dialog field, …), where the shortcut is left alone
  function composer() {
    const active = document.activeElement;
    const focused = active?.closest(COMPOSER);
    const usable = `${COMPOSER}:has(${FILE_INPUT}, ${ATTACH_BUTTON})`;
    if (focused) return focused.matches(usable) ? focused : null;
    if (active?.matches(EDITABLE)) return null;
    return document.querySelector(`.p-workspace__primary_view ${usable}`) || document.querySelector(usable);
  }

  // Resolves with the first element matching the selector, or null after the timeout
  function waitFor(selector, timeout) {
    return new Promise((resolve) => {
      const found = document.querySelector(selector);
      if (found) return resolve(found);
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) done(el);
      });
      const timer = setTimeout(() => done(null), timeout);
      function done(el) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(el);
      }
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  async function openUpload(box) {
    const input = box.querySelector(FILE_INPUT);
    if (input) return input.click();
    // Fallback should Slack drop the input: go through the "+" menu, once it has rendered
    const attach = box.querySelector(ATTACH_BUTTON);
    if (!attach) return;
    attach.click();
    (await waitFor(UPLOAD_ITEM, MENU_TIMEOUT))?.click();
  }

  const isMac = /mac/i.test(navigator.userAgentData?.platform || navigator.platform || '');
  const useMeta = MODIFIER === 'auto' ? isMac : MODIFIER === 'meta';

  // Capture phase, so Slack's own handlers (and the browser's) never see the shortcut
  window.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    const modifier = useMeta ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
    if (!modifier || e.altKey || e.shiftKey || e.code !== 'KeyU' || e.repeat) return;
    const box = composer();
    if (!box) return;
    e.preventDefault();
    e.stopPropagation();
    openUpload(box);
  }, true);
})();
