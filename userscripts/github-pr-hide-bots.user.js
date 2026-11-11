// ==UserScript==
// @name         GitHub — Hide bots on pull requests
// @namespace    https://github.com/g-ongenae/dotfiles
// @author       g-ongenae
// @version      1.1.0
// @description  Adds a "Hide bots" button to pull request conversations: it hides the comments and reviews of bots and AI reviewers (except SonarCloud, Socket and algoanbot), the replies written by Claude (Co-Authored-By: Claude … noreply@anthropic.com or 🤖 Generated with Claude Code), the @coderabbitai review commands, the resolved threads and the timeline events, leaving the description, the commits, the human comments and the linked issues and pull requests. Works on the Overview preview (the button sits left of All / Unresolved / Mine) and on the classic conversation (in the page header). The choice is remembered.
// @license      MIT
// @homepageURL  https://github.com/g-ongenae/dotfiles/blob/main/userscripts/github-pr-hide-bots.user.js
// @supportURL   https://github.com/g-ongenae/dotfiles/issues
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
  // Signatures of the comments Claude posts on behalf of a developer: the co-author trailer or the
  // "🤖 Generated with Claude Code" footer (its link is gone from the rendered text). Never applied to the description.
  const AUTO_REPLY = /Co-Authored-By:[^\n]*noreply@anthropic\.com|Generated with \[?Claude Code\b/i;
  // Comments asking CodeRabbit for a review: "@coderabbitai review" or "@coderabbitai full review"
  const BOT_COMMAND = /@coderabbitai\s+(full\s+)?review\b/i;
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
    return /\/apps\//.test(a.getAttribute('href') || '') || /[?&]bot=|%5Bbot%5D|\[bot\]/i.test(a.dataset.hovercardUrl || '');
  }

  const isNoiseText = (text) => AUTO_REPLY.test(text) || BOT_COMMAND.test(text);

  // Author link and rendered body of a comment: Overview (React) first, then the classic conversation
  const AUTHOR = '[data-testid="avatar-link"], a.author';
  const BODY = '.markdown-body, .comment-body';

  // One comment: an issue comment, or a comment of a review thread
  function isNoise(comment) {
    if (comment.querySelector('[data-testid="automated-review-comment"]')) return true; // Copilot inline comment
    if (isBot(comment.querySelector(AUTHOR))) return true;
    return isNoiseText(comment.querySelector(BODY)?.textContent || '');
  }

  // ---------- Overview preview (?overview=true, React) ----------
  // Each item wraps an <article>: an issue comment, a review (header, body, then its threads as nested
  // <article>s) or nothing (a group of commits). The timeline events live in the sidebar's Activity.
  const OVERVIEW_ITEM = '[data-testid="timeline-item"]';
  const HEADER = '[data-testid="comment-header"]';
  // Approvals and change requests, by the text next to the author or the status ring of the avatar
  const VERDICT = /^(approved|requested changes|changes requested)\b/i;

  // Widest ancestor of el, below root, still passing test
  function widest(el, root, test) {
    while (el.parentElement && el.parentElement !== root && test(el.parentElement)) el = el.parentElement;
    return el;
  }

  // Elements of root not inside a nested <article> (its threads), and these threads themselves
  const own = (root, sel) => [...root.querySelectorAll(sel)].filter((el) => el.parentElement.closest('article') === root);

  function classifyOverviewReview(item, review) {
    const author = own(review, AUTHOR)[0];
    const bot = isBot(author);
    const hidden = [];
    let visibleThreads = 0;
    for (const thread of own(review, 'article')) {
      if (thread.querySelector('[aria-label^="Unresolve conversation"]')) { hidden.push(thread); continue; }
      // Each comment: the widest block around its header holding no other comment
      const comments = [...thread.querySelectorAll(HEADER)]
        .map((h) => widest(h, thread, (p) => p.querySelectorAll(HEADER).length === 1));
      // Folded and not loaded: started by the review's author, so as noisy as the review
      const noise = comments.length ? comments.map(isNoise) : [bot];
      if (noise.every(Boolean)) { hidden.push(thread); continue; }
      visibleThreads++;
      // Keep the first comment for context, even a bot's, when a human answered it
      comments.forEach((c, i) => { if (i > 0 && noise[i]) hidden.push(c); });
    }

    const body = own(review, BODY)[0];
    const text = body?.textContent.trim() || '';
    const humanBody = !bot && text !== '' && !isNoiseText(text);
    const header = own(review, HEADER)[0];
    const verdict = !bot && !!header && (!!header.querySelector('[class*="approvedStatus"]')
      || [...header.querySelectorAll('span')].some((s) => VERDICT.test(s.textContent.trim())));

    if (!humanBody && !visibleThreads && !verdict) return [item];
    // The body without the threads that follow it
    if (!humanBody && body) hidden.push(widest(body, review, (p) => !p.querySelector('article')));
    return hidden;
  }

  // Returns the elements of an Overview item to hide
  function classifyOverview(item) {
    const article = item.querySelector('article');
    if (!article) return []; // commits
    if (article.id.startsWith('issuecomment-')) return isNoise(article) ? [item] : [];
    if (article.id.startsWith('pullrequestreview-')) return classifyOverviewReview(item, article);
    return [];
  }

  // ---------- Classic conversation (?overview=false) ----------
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
  function classifyClassic(item) {
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
    const humanBody = !bot && text !== '' && !isNoiseText(text);
    // Approvals and change requests of humans stay, even without a comment
    const verdict = !bot && !!item.querySelector('.TimelineItem-badge .octicon-check, .TimelineItem-badge .octicon-file-diff');

    if (!humanBody && !visibleThreads && !verdict) return [item];
    if (!humanBody && body) hidden.push(body.closest('.TimelineItem') || body);
    return hidden;
  }

  // ---------- Main pass (GitHub navigates with Turbo, the Overview re-renders with React) ----------
  // The Overview preview is GitHub's default; the classic conversation is kept for ?overview=false
  const VIEWS = [
    { items: OVERVIEW_ITEM, classify: classifyOverview },
    { items: '.js-timeline-item', classify: classifyClassic },
  ];
  let count = 0;

  function mark() {
    count = 0;
    for (const { items, classify } of VIEWS) for (const item of document.querySelectorAll(items)) {
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
    btn.title = 'Hide the bot and AI comments, the replies written by Claude, the @coderabbitai review commands, the resolved threads and the timeline events';
    btn.addEventListener('click', () => {
      on = !on;
      localStorage.setItem(KEY, on ? '1' : '0');
      document.documentElement.toggleAttribute(ON, on);
      label(btn);
    });
    return btn;
  }

  // Overview: left of the All / Unresolved / Mine switch of the Comments section. Classic: in the page
  // header, before Edit/Code. Floating at the bottom right if GitHub changed both
  function place(btn) {
    const views = document.querySelector('ul[aria-label="Comments view mode"]')?.parentElement;
    const actions = document.querySelector('[data-component="PH_Actions"]');
    // Only move on change: the observer watches the DOM
    if (views) { if (btn.nextElementSibling !== views) views.before(btn); }
    else if (actions) { if (btn.parentElement !== actions) actions.prepend(btn); }
    else if (btn.parentElement !== document.body) document.body.appendChild(btn);
    btn.classList.toggle('ghb-floating', btn.parentElement === document.body);
  }

  function run() {
    let btn = document.getElementById(BTN);
    if (!CONVERSATION.test(location.pathname)) { btn?.remove(); return; }
    btn ||= makeButton();
    mark();
    place(btn);
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
