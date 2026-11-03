// ==UserScript==
// @name         GitHub — Hide bots on pull requests
// @namespace    https://github.com/g-ongenae/dotfiles
// @author       g-ongenae
// @version      1.0.1
// @description  Adds a "Hide bots" button to pull request conversations: it hides the comments and reviews of bots and AI reviewers (except SonarCloud, Socket and algoanbot), the replies written by Claude (Co-Authored-By: Claude … noreply@anthropic.com), the resolved threads and the timeline events, leaving the description, the commits, the human comments and the linked issues and pull requests. The choice is remembered.
// @match        https://github.com/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Settings ----------
  // Bots (GitHub Apps, by login) whose comments stay visible
  const KEEP_BOTS = ['sonarqubecloud', 'socket-security', 'algoanbot'];
  // Signature of the comments Claude posts on behalf of a developer. Never applied to the description.
  const AUTO_REPLY = /Co-Authored-By:[^\n]*noreply@anthropic\.com/i;
  // Timeline events (labels, review requests, draft/ready…) are hidden, except links to other issues
  // and pull requests and these kinds,
  // by the prefix of their data-gid: merged, closed, reopened
  const KEEP_EVENTS = ['ME_', 'CE_', 'REE_'];

  const KEY = 'ghb-on';
  const ON = 'data-ghb-on'; // on <html>
  const HIDE = 'data-ghb-hide'; // on each hidden element
  const BTN = 'ghb-toggle';
  const CONVERSATION = /^\/[^/]+\/[^/]+\/pull\/\d+\/?$/;

  let on = localStorage.getItem(KEY) === '1';

  // ---------- Styles ----------
  // Injected at document-start so the hidden items never flash
  const style = document.createElement('style');
  style.textContent = `
    html[${ON}] [${HIDE}] { display: none !important; }
    #${BTN}.ghb-floating { position: fixed; right: 16px; bottom: 16px; z-index: 100; }
  `;
  (document.head || document.documentElement).appendChild(style);

  // ---------- Classification ----------
  const login = (a) => (a.getAttribute('href') || '').split('/').filter(Boolean).pop()?.toLowerCase() || '';

  function isBot(a) {
    if (!a || KEEP_BOTS.includes(login(a))) return false;
    return /\/apps\//.test(a.getAttribute('href') || '') || /[?&]bot=/.test(a.dataset.hovercardUrl || '');
  }

  // One comment: an issue comment, or a comment of a review thread
  function isNoise(comment) {
    if (comment.querySelector('[data-testid="automated-review-comment"]')) return true; // Copilot inline comment
    if (isBot(comment.querySelector('a.author'))) return true;
    return AUTO_REPLY.test(comment.querySelector('.comment-body')?.textContent || '');
  }

  // A mention, cross-reference or link of another issue or pull request
  function linksIssue(event) {
    const self = `${location.pathname.replace(/\/$/, '')}/hovercard`;
    return [...event.querySelectorAll('a[data-hovercard-url]')].some((a) => {
      const url = a.dataset.hovercardUrl;
      return /\/(issues|pull)\/\d+\/hovercard$/.test(url) && url !== self;
    });
  }

  // An item of events groups several in a row, each a .TimelineItem; the item's data-gid is the first one's
  function classifyEvents(item, gid) {
    const events = [...item.querySelectorAll('.TimelineItem')].filter((e) => !e.parentElement.closest('.TimelineItem'));
    const keepFirst = KEEP_EVENTS.some((p) => gid.startsWith(p));
    const hidden = events.filter((e, i) => !(i === 0 && keepFirst) && !linksIssue(e));
    return hidden.length === events.length ? [item] : hidden;
  }

  // Returns the elements of a timeline item to hide
  function classify(item) {
    const gid = item.dataset.gid || '';
    if (!gid || gid.startsWith('C_')) return []; // commits
    if (gid.startsWith('IC_')) return isNoise(item) ? [item] : [];
    if (!gid.startsWith('PRR_')) return classifyEvents(item, gid);

    // Review: header, optional body, then its threads
    const hidden = [];
    let visibleThreads = 0;
    for (const thread of item.querySelectorAll('.js-resolvable-timeline-thread-container')) {
      if (thread.dataset.resolved === 'true') { hidden.push(thread); continue; }
      const comments = [...thread.querySelectorAll('.js-comments-holder > [id^="discussion_r"]')];
      // Not loaded yet: leave it, it is classified once its comments arrive
      if (!comments.length && thread.querySelector('include-fragment')) { visibleThreads++; continue; }
      const noise = comments.map(isNoise);
      if (noise.every(Boolean)) { hidden.push(thread); continue; }
      visibleThreads++;
      // Keep the first comment for context, even a bot's, when a human answered it
      comments.forEach((c, i) => { if (i > 0 && noise[i]) hidden.push(c); });
    }

    const bot = isBot(item.querySelector('a.author'));
    const body = item.querySelector('.timeline-comment-group[id^="pullrequestreview-"]');
    const text = body?.querySelector('.comment-body')?.textContent.trim() || '';
    const humanBody = !bot && text !== '' && !AUTO_REPLY.test(text);
    // Approvals and change requests of humans stay, even without a comment
    const verdict = !bot && !!item.querySelector('.TimelineItem-badge .octicon-check, .TimelineItem-badge .octicon-file-diff');

    if (!humanBody && !visibleThreads && !verdict) return [item];
    if (!humanBody && body) hidden.push(body.closest('.TimelineItem') || body);
    return hidden;
  }

  // ---------- Main pass (GitHub navigates with Turbo) ----------
  let count = 0;

  function mark() {
    count = 0;
    for (const item of document.querySelectorAll('.js-timeline-item')) {
      const hidden = new Set(classify(item));
      if (hidden.has(item)) count++;
      for (const el of item.querySelectorAll(`[${HIDE}]`)) if (!hidden.has(el)) el.removeAttribute(HIDE);
      item.toggleAttribute(HIDE, hidden.has(item));
      for (const el of hidden) if (el !== item) el.setAttribute(HIDE, '');
    }
  }

  function label(btn) {
    const text = `${on ? 'Show' : 'Hide'} bots (${count})`;
    // Only write on change: the observer watches the DOM
    if (btn.textContent !== text) btn.textContent = text;
    btn.setAttribute('aria-pressed', String(on));
  }

  function makeButton() {
    const btn = document.createElement('button');
    btn.id = BTN;
    btn.type = 'button';
    btn.className = 'Button Button--secondary Button--medium';
    btn.title = 'Hide the bot and AI comments, the replies written by Claude, the resolved threads and the timeline events';
    btn.addEventListener('click', () => {
      on = !on;
      localStorage.setItem(KEY, on ? '1' : '0');
      document.documentElement.toggleAttribute(ON, on);
      label(btn);
    });
    return btn;
  }

  function run() {
    let btn = document.getElementById(BTN);
    if (!CONVERSATION.test(location.pathname)) { btn?.remove(); return; }
    mark();
    if (!btn) {
      btn = makeButton();
      // In the page header, before Edit/Code; floating at the bottom right if GitHub changed it
      const actions = document.querySelector('[data-component="PH_Actions"]');
      if (actions) actions.prepend(btn);
      else { btn.classList.add('ghb-floating'); document.body.appendChild(btn); }
    }
    label(btn);
  }

  document.documentElement.toggleAttribute(ON, on);
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; run(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
