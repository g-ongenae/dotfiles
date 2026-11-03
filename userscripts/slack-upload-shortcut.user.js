// ==UserScript==
// @name         Slack — Upload shortcut
// @namespace    https://github.com/g-ongenae/dotfiles
// @version      1.1.0
// @description  Cmd+U (Ctrl+U off macOS) opens the file picker of the message composer, like "Upload from your computer" in its "+" menu.
// @match        https://app.slack.com/*
// @run-at       document-start
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

  // The composer being typed in, else the one of the conversation
  function composer() {
    const focused = document.activeElement?.closest(COMPOSER);
    if (focused?.querySelector(FILE_INPUT)) return focused;
    return document.querySelector(`.p-workspace__primary_view ${COMPOSER}:has(${FILE_INPUT})`)
      || document.querySelector(`${COMPOSER}:has(${FILE_INPUT})`);
  }

  function openUpload() {
    const box = composer();
    const input = box?.querySelector(FILE_INPUT);
    if (input) return input.click();
    // Fallback should Slack drop the input: go through the "+" menu
    const attach = (box || document).querySelector(ATTACH_BUTTON);
    if (!attach) return;
    attach.click();
    requestAnimationFrame(() => document.querySelector(UPLOAD_ITEM)?.click());
  }

  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  const useMeta = MODIFIER === 'auto' ? /mac/i.test(platform) : MODIFIER === 'meta';

  // Capture phase, so Slack's own handlers (and the browser's) never see the shortcut
  window.addEventListener('keydown', (e) => {
    const modifier = useMeta ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
    if (!modifier || e.altKey || e.shiftKey || e.code !== 'KeyU' || e.repeat) return;
    e.preventDefault();
    e.stopPropagation();
    openUpload();
  }, true);
})();
