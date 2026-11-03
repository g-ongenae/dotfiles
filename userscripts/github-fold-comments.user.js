// ==UserScript==
// @name         GitHub — Fold comments
// @namespace    https://github.com/g-ongenae/dotfiles
// @author       g-ongenae
// @version      1.0.1
// @description  Adds a chevron button to the header of each review, comment and description on GitHub pull requests and issues: it folds the comment down to its header. Alt-click folds or unfolds every comment of the page. Each choice is remembered.
// @match        https://github.com/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Settings ----------
  // Folded comments remembered, the oldest are forgotten first
  const MAX_REMEMBERED = 2000;

  const KEY = 'ghc-folded';
  const FOLDED = 'data-ghc-folded'; // on each folded comment
  const BTN = 'ghc-toggle';

  // Pull requests (server-rendered timeline) and issues (React) use different markup
  const KINDS = [
    {
      // Pull request review: "… reviewed" header row, then the review comment and the threads
      box: '.js-timeline-item[data-gid^="PRR_"]',
      id: (box) => box.dataset.gid,
      hidden: '.TimelineItem ~ *',
      extra: '',
      // Right of the header row, after "View reviewed changes"
      mount(box, btn) {
        const header = box.querySelector('.TimelineItem > .TimelineItem-body');
        (header?.querySelector(':scope > .flex-shrink-0') || header)?.appendChild(btn);
      },
    },
    {
      // Pull request description, comments, reviews and review comments: header, then the body
      box: '.js-comment:is(.timeline-comment, .review-comment, .js-minimizable-comment-group):not(.minimized-comment)',
      // Comments carry their id on the wrapper around them
      id: (box) => box.id || box.parentElement.closest('[id]')?.id || '',
      hidden: '> :not(:first-child)',
      extra: '> .timeline-comment-header { border-bottom: 0; }',
      // Left of the "…" menu
      mount: (box, btn) => box.querySelector(':scope > :first-child .timeline-comment-actions')?.prepend(btn),
    },
    {
      // Issue description
      box: '[data-testid="issue-body"]',
      id: () => `body:${location.pathname}`,
      hidden: '[data-testid="issue-body-viewer"]',
      extra: '',
      mount: (box, btn) => box.querySelector('[class*="actionsSection"]')?.appendChild(btn),
    },
    {
      // Issue comments: header, then the body and reactions
      box: '[data-testid^="comment-viewer-outer-box-"]',
      id: (box) => box.dataset.testid.replace('comment-viewer-outer-box-', ''),
      hidden: '> :not([data-testid="comment-header"])',
      extra: '',
      mount: (box, btn) => box.querySelector('[data-testid="comment-header-right-side-items"]')?.appendChild(btn),
    },
  ];

  let folded = new Set();
  try { folded = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { /* corrupted: start over */ }

  function save() {
    localStorage.setItem(KEY, JSON.stringify([...folded].slice(-MAX_REMEMBERED)));
  }

  // ---------- Styles ----------
  // Injected at document-start so a folded comment never flashes before being hidden
  const style = document.createElement('style');
  style.textContent = KINDS.map((k) => `
    ${k.box}[${FOLDED}] ${k.hidden} { display: none !important; }
    ${k.extra ? `${k.box}[${FOLDED}] ${k.extra}` : ''}
  `).join('') + `
    .${BTN} { margin: 0 4px; vertical-align: middle; }
    .${BTN} svg { transition: transform 0.15s; }
    .${BTN}[aria-expanded="false"] svg { transform: rotate(-90deg); }
  `;
  (document.head || document.documentElement).appendChild(style);

  // ---------- Toggle ----------
  // A review contains the button of its comment: find each box's own by its id
  const ownButton = (box, id) => box.querySelector(`.${BTN}[data-ghc-for="${CSS.escape(id)}"]`);

  function apply(box, id) {
    const isFolded = folded.has(id);
    // Only write on change: the page is re-scanned on every DOM change
    if (box.hasAttribute(FOLDED) !== isFolded) box.toggleAttribute(FOLDED, isFolded);
    const btn = ownButton(box, id);
    if (btn && btn.getAttribute('aria-expanded') !== String(!isFolded)) {
      btn.setAttribute('aria-expanded', String(!isFolded));
      btn.title = `${isFolded ? 'Unfold' : 'Fold'} (Alt-click: all comments)`;
      btn.setAttribute('aria-label', btn.title);
    }
  }

  function setFolded(id, value) {
    folded.delete(id); // re-added last, so it is forgotten last
    if (value) folded.add(id);
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  function chevron() {
    // Octicon chevron-down; rotated to point right while folded
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('octicon');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z');
    svg.appendChild(path);
    return svg;
  }

  function makeButton(kind, box) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `${BTN} btn-octicon`;
    btn.dataset.ghcFor = kind.id(box);
    btn.appendChild(chevron());
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const value = !folded.has(kind.id(box));
      if (e.altKey) for (const [k, b] of boxes()) setFolded(k.id(b), value);
      else setFolded(kind.id(box), value);
      save();
      run();
    });
    return btn;
  }

  // ---------- Main pass (GitHub navigates with Turbo, issues re-render with React) ----------
  function* boxes() {
    for (const kind of KINDS) for (const box of document.querySelectorAll(kind.box)) yield [kind, box];
  }

  function run() {
    for (const [kind, box] of boxes()) {
      const id = kind.id(box);
      if (!id) continue;
      if (!ownButton(box, id)) kind.mount(box, makeButton(kind, box));
      apply(box, id);
    }
  }

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; run(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
