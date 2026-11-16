// ==UserScript==
// @name         Hacker News — Keyboard shortcuts
// @namespace    https://github.com/g-ongenae/dotfiles
// @author       g-ongenae
// @version      1.0.0
// @description  Drives Hacker News from the keyboard: j / k (or ↓ / ↑) move between stories or comments, o opens the link in a new tab, d opens the discussion, f folds / unfolds the comment, n goes to the next page, . / t to the top, r reloads, h opens the home page and ? lists the shortcuts.
// @license      MIT
// @homepageURL  https://github.com/g-ongenae/dotfiles/blob/main/userscripts/hackernews-keyboard.user.js
// @supportURL   https://github.com/g-ongenae/dotfiles/issues
// @match        https://news.ycombinator.com/*
// @run-at       document-idle
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Settings ----------
  // Space kept above the story or comment moved to, when it has to be scrolled into view
  const MARGIN_PX = 8;

  // Stories (lists, top of a discussion) and comments are both `tr.athing` rows; a story's score,
  // author and links sit in the row after it. Folded comments hide their replies (display: none).
  const ITEM = 'tr.athing';
  const TITLE_LINK = '.titleline > a';
  // The links of a comment's text (not its author, age or navigation links)
  const COMMENT_LINK = '.commtext a[href]';
  const FOLD = 'a.togg';
  const MORE = 'a.morelink';
  const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
  const CURRENT = 'data-hnk-current'; // the story or comment moved to

  const SHORTCUTS = [
    ['j  ↓', 'Next story or comment'],
    ['k  ↑', 'Previous story or comment'],
    ['o', 'Open the link in a new tab'],
    ['d', 'Open the discussion'],
    ['f', 'Fold / unfold the comment and its replies'],
    ['n', 'Next page'],
    ['.  t', 'Top of the page'],
    ['r', 'Reload the page'],
    ['h', 'Home page'],
    ['Esc', 'Leave the comment box'],
    ['?', 'Show / hide this list'],
  ];

  // ---------- Styles ----------
  // A comment is highlighted from its text on (not its indentation), a story with the row below it
  const style = document.createElement('style');
  style.textContent = `
    [${CURRENT}] td.default,
    [${CURRENT}]:not(:has(td.default)) > td,
    [${CURRENT}]:not(:has(td.default)) + tr > td {
      background: rgba(255, 102, 0, 0.1);
    }
    [${CURRENT}] td.default,
    [${CURRENT}]:not(:has(td.default)) > td:first-child,
    [${CURRENT}]:not(:has(td.default)) + tr > td:first-child {
      box-shadow: inset 3px 0 #ff6600;
    }
  `;
  document.head.append(style);

  // The help and the messages live in a shadow root, safe from Hacker News's styles
  const host = document.createElement('div');
  const ui = host.attachShadow({ mode: 'open' });
  const uiStyle = document.createElement('style');
  uiStyle.textContent = `
    :host { all: initial; }
    .help {
      position: fixed; inset: 0; z-index: 2147483647;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.4);
    }
    .panel, .toast {
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      font: 13px/1.5 Verdana, Geneva, sans-serif;
    }
    .panel {
      min-width: 320px; max-height: 90vh; overflow: auto; padding: 0 0 16px;
      border-radius: 6px; background: #f6f6ef; color: #000;
    }
    h2 { margin: 0 0 12px; padding: 8px 20px; background: #ff6600; font-size: 14px; font-weight: bold; }
    table { border-collapse: collapse; margin: 0 20px; }
    td { padding: 3px 0; vertical-align: top; }
    td:first-child { padding-right: 20px; white-space: nowrap; }
    kbd {
      display: inline-block; min-width: 1.6em; padding: 1px 6px; text-align: center;
      border: 1px solid rgba(0, 0, 0, 0.2); border-bottom-width: 2px; border-radius: 4px;
      background: #fff; font: 12px ui-monospace, monospace; white-space: pre;
    }
    .toast {
      position: fixed; z-index: 2147483647; left: 50%; bottom: 24px; transform: translateX(-50%);
      padding: 8px 14px; border-radius: 6px; background: #333; color: #fff;
    }
  `;
  ui.append(uiStyle);

  function show(el) {
    if (!host.isConnected) document.documentElement.append(host);
    ui.append(el);
  }

  let toastTimer = 0;
  function toast(text) {
    ui.querySelector('.toast')?.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    show(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 2500);
  }

  // ---------- Items ----------
  const visible = (el) => el.getClientRects().length > 0;
  const items = () => [...document.querySelectorAll(ITEM)].filter(visible);
  const isComment = (item) => item.querySelector('td.default') !== null;

  // The rows an item spans: a story's score and links are in the next row
  function bounds(item) {
    const r = item.getBoundingClientRect();
    const below = isComment(item) ? null : item.nextElementSibling;
    return { top: r.top, bottom: below ? below.getBoundingClientRect().bottom : r.bottom };
  }

  function onScreen(item) {
    const { top, bottom } = bounds(item);
    return bottom > 0 && top < window.innerHeight;
  }

  let current = null;

  function select(item) {
    if (current) current.removeAttribute(CURRENT);
    current = item;
    item.setAttribute(CURRENT, '');
    // Scrolls only when it is not wholly on screen, putting its top at the top: long comments are
    // read from their start
    const { top, bottom } = bounds(item);
    if (top < 0 || bottom > window.innerHeight) window.scrollBy(0, top - MARGIN_PX);
  }

  // The item moved to, unless it was folded or scrolled away: then the first one on screen
  function target(list = items()) {
    if (current && list.includes(current) && onScreen(current)) return current;
    return list.find((item) => bounds(item).top >= 0) || list.find(onScreen) || null;
  }

  // False when the page has nothing to move between, so that the arrows scroll it as usual
  function move(step) {
    const list = items();
    if (!list.length) return false;
    const from = target(list);
    if (from !== current) select(from || list[list.length - 1]);
    else select(list[Math.max(0, Math.min(list.length - 1, list.indexOf(from) + step))]);
    return true;
  }

  // The target, made current
  function pick() {
    const item = target();
    if (item && item !== current) select(item);
    if (!item) toast('No story or comment on screen');
    return item;
  }

  // A story's link, or the first link in a comment's text
  function open() {
    const item = pick();
    if (!item) return;
    const link = item.querySelector(isComment(item) ? COMMENT_LINK : TITLE_LINK);
    if (link) window.open(link.href, '_blank', 'noopener');
    else toast('No link in this comment');
  }

  // Every story and comment has its own discussion page, under its id
  function discuss() {
    const item = pick();
    if (item) location.assign(`/item?id=${item.id}`);
  }

  function fold() {
    const item = pick();
    if (!item) return;
    const toggle = item.querySelector(FOLD);
    if (toggle) toggle.click();
    else toast('Only comments fold');
  }

  // ---------- Pages ----------
  function nextPage() {
    const more = document.querySelector(MORE);
    if (more) location.assign(more.href);
    else toast('No next page');
  }

  function top() {
    window.scrollTo(0, 0);
    if (current) current.removeAttribute(CURRENT);
    current = null;
  }

  // ---------- Help ----------
  let help = null;

  function toggleHelp() {
    if (help) {
      help.remove();
      help = null;
      return;
    }
    help = document.createElement('div');
    help.className = 'help';
    const panel = document.createElement('div');
    panel.className = 'panel';
    const title = document.createElement('h2');
    title.textContent = 'Keyboard shortcuts';
    const table = document.createElement('table');
    for (const [key, label] of SHORTCUTS) {
      const row = table.insertRow();
      const kbd = document.createElement('kbd');
      kbd.textContent = key;
      row.insertCell().append(kbd);
      row.insertCell().textContent = label;
    }
    panel.append(title, table);
    help.append(panel);
    help.addEventListener('click', (e) => e.target === help && toggleHelp());
    show(help);
  }

  // ---------- Keys ----------
  // An action returning false leaves the key to the browser
  const KEYS = {
    j: () => move(1),
    k: () => move(-1),
    ArrowDown: () => move(1),
    ArrowUp: () => move(-1),
    o: open,
    d: discuss,
    f: fold,
    n: nextPage,
    '.': top,
    t: top,
    r: () => location.reload(),
    h: () => location.assign('/'),
    '?': toggleHelp,
  };

  // Keys are read from `e.key`, Shift included: on AZERTY, . and ? are typed with Shift
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target instanceof Element ? e.target : null;

      if (e.key === 'Escape') {
        if (help) {
          e.preventDefault();
          toggleHelp();
        } else if (el?.closest(EDITABLE)) {
          el.blur();
        }
        return;
      }

      if (el?.closest(EDITABLE)) return;
      // Shift + arrows are left to the browser (text selection)
      if (e.shiftKey && e.key.startsWith('Arrow')) return;
      const action = KEYS[e.key];
      if (!action || (help && e.key !== '?')) return;
      // Holding a key repeats only the moves
      if (e.repeat && !/^Arrow|^[jk]$/.test(e.key)) return e.preventDefault();
      if (action() !== false) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true,
  );
})();
