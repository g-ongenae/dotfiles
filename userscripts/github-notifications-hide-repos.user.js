// ==UserScript==
// @name         GitHub — Hide repositories from notifications
// @namespace    https://github.com/g-ongenae/dotfiles
// @author       g-ongenae
// @version      1.1.0
// @description  Adds a "Hide" button to the header of each repository group of the GitHub notifications page: the repository's notifications stay hidden, even after a reload. A crossed-out eye next to the repository in the sidebar shows it again. Filtering on the repository still lists its notifications. Hiding is display-only: hidden notifications still count in the inbox badge.
// @license      MIT
// @homepageURL  https://github.com/g-ongenae/dotfiles/blob/main/userscripts/github-notifications-hide-repos.user.js
// @supportURL   https://github.com/g-ongenae/dotfiles/issues
// @match        https://github.com/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const KEY = 'ghn-hidden-repos';
  const BTN = 'ghn-hide';
  const SHOW = 'ghn-show';

  // Lowercase "owner/repo" names: GitHub's are case-insensitive. They go into CSS selectors, so
  // anything else (a hand-edited entry) is dropped rather than break the whole stylesheet.
  const REPO = /^[\w.-]+\/[\w.-]+$/;
  let hidden = new Set();
  function load() {
    let list;
    try { list = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { list = []; }
    hidden = new Set(Array.isArray(list) ? list.filter((r) => typeof r === 'string' && REPO.test(r)) : []);
  }
  load();

  function setHidden(repo, value) {
    if (!REPO.test(repo)) return;
    if (value) hidden.add(repo);
    else hidden.delete(repo);
    localStorage.setItem(KEY, JSON.stringify([...hidden].sort()));
    run();
  }

  // ---------- Styles ----------
  // Injected at document-start, and rebuilt from the stored list, so a hidden repository never flashes
  const style = document.createElement('style');
  (document.head || document.documentElement).appendChild(style);

  // Repositories the page is filtered on (?query=repo:owner/name) stay visible: that's an explicit ask
  function filtered() {
    const query = new URLSearchParams(location.search).get('query') || '';
    return new Set([...query.matchAll(/\brepo:(\S+)/gi)].map((m) => m[1].toLowerCase()));
  }

  function css() {
    const shown = filtered();
    const repos = [...hidden].filter((r) => !shown.has(r));
    const rules = repos.flatMap((r) => [
      // Grouped by repository: the whole box, found by the link of its header
      `.js-notifications-group:has(> .Box-header h3 a[href$="/${r}" i])`,
      // Grouped by date: each notification, found by its link
      `.js-notifications-list-item:has(a.notification-list-item-link:is([href^="/${r}/" i], [href^="https://github.com/${r}/" i]))`,
    ]);
    return `
      ${rules.length ? `${rules.join(',\n')} { display: none !important; }` : ''}
      .${BTN} { flex-shrink: 0; }
      .${SHOW} {
        display: inline-flex; padding: 2px; margin-right: 4px; border: 0; border-radius: 6px;
        background: none; color: var(--fgColor-muted, #59636e); cursor: pointer; vertical-align: middle;
      }
      .${SHOW}:hover { color: var(--fgColor-accent, #0969da); background: var(--bgColor-neutral-muted, #818b981f); }
      .${SHOW} .ghn-eye, .${SHOW}:hover .ghn-eye-closed { display: none; }
      .${SHOW}:hover .ghn-eye { display: inline; }
      li:has(> a > .ActionListItem-visual > .${SHOW}) .ActionListItem-label { color: var(--fgColor-muted, #59636e); }
    `;
  }

  // ---------- Icons ----------
  const SVG_NS = 'http://www.w3.org/2000/svg';
  // Octicons eye-closed and eye
  const EYE_CLOSED = 'M.143 2.31a.75.75 0 0 1 1.047-.167l14.5 10.5a.75.75 0 1 1-.88 1.214l-2.248-1.628C11.346 13.19 9.792 14 8 14c-1.981 0-3.67-.992-4.933-2.078C1.797 10.832.88 9.577.43 8.9a1.619 1.619 0 0 1 0-1.797c.353-.533.995-1.42 1.868-2.305L.31 3.357A.75.75 0 0 1 .143 2.31Zm1.536 5.622A.12.12 0 0 0 1.657 8c0 .021.006.045.022.068.412.621 1.242 1.75 2.366 2.717C5.175 11.758 6.527 12.5 8 12.5c1.195 0 2.31-.488 3.29-1.191L9.063 9.695A2 2 0 0 1 6.058 7.52L3.529 5.688a14.207 14.207 0 0 0-1.85 2.244ZM8 3.5c-.516 0-1.017.09-1.499.251a.75.75 0 1 1-.473-1.423A6.207 6.207 0 0 1 8 2c1.981 0 3.67.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.11.166-.248.365-.41.587a.75.75 0 1 1-1.21-.887c.148-.201.272-.382.371-.53a.119.119 0 0 0 0-.137c-.412-.621-1.242-1.75-2.366-2.717C10.825 4.242 9.473 3.5 8 3.5Z';
  const EYE = 'M8 2c1.981 0 3.671.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.45.678-1.367 1.932-2.637 3.023C11.67 13.008 9.981 14 8 14c-1.981 0-3.671-.992-4.933-2.078C1.797 10.83.88 9.576.43 8.898a1.62 1.62 0 0 1 0-1.798c.45-.677 1.367-1.931 2.637-3.022C4.33 2.992 6.019 2 8 2ZM1.679 7.932a.12.12 0 0 0 0 .136c.411.622 1.241 1.75 2.366 2.717C5.176 11.758 6.527 12.5 8 12.5c1.473 0 2.825-.742 3.955-1.715 1.124-.967 1.954-2.096 2.366-2.717a.12.12 0 0 0 0-.136c-.412-.621-1.242-1.75-2.366-2.717C10.824 4.242 9.473 3.5 8 3.5c-1.473 0-2.825.742-3.955 1.715-1.124.967-1.954 2.096-2.366 2.717ZM8 10a2 2 0 1 1-.001-3.999A2 2 0 0 1 8 10Z';

  function icon(d, cls) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('octicon', cls);
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
    return svg;
  }

  // ---------- Buttons ----------
  // "Hide", left of the group's "Mark as done"
  function hideButton(repo) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `${BTN} btn btn-sm`;
    btn.title = `Hide the notifications of ${repo}`;
    const span = document.createElement('span');
    span.className = 'text-center d-inline-block';
    span.style.width = '16px';
    span.appendChild(icon(EYE_CLOSED, 'ghn-eye-closed'));
    btn.append(span, ' Hide');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      setHidden(repo, true);
    });
    return btn;
  }

  // Crossed-out eye in the sidebar, turning into an open eye on hover
  function showButton(repo) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = SHOW;
    btn.title = `Hidden — show the notifications of ${repo} again`;
    btn.setAttribute('aria-label', btn.title);
    btn.append(icon(EYE_CLOSED, 'ghn-eye-closed'), icon(EYE, 'ghn-eye'));
    btn.addEventListener('click', (e) => {
      // The button sits in the repository's filter link
      e.preventDefault();
      e.stopPropagation();
      setHidden(repo, false);
    });
    return btn;
  }

  // ---------- Main pass (GitHub navigates with Turbo) ----------
  function run() {
    // Elsewhere, drop the rules rather than rebuild them on every mutation
    const onPage = location.pathname.startsWith('/notifications');
    const text = onPage ? css() : '';
    if (style.textContent !== text) style.textContent = text;
    if (!style.isConnected) (document.head || document.documentElement).appendChild(style);
    if (!onPage) return;

    for (const header of document.querySelectorAll('.js-notifications-group > .Box-header')) {
      if (header.querySelector(`.${BTN}`)) continue;
      const repo = header.querySelector('h3 a')?.textContent.trim().toLowerCase();
      if (!repo || !REPO.test(repo)) continue;
      const done = header.querySelector('.js-grouped-notifications-mark-all-read-button');
      done ? done.before(hideButton(repo)) : header.appendChild(hideButton(repo));
    }

    for (const link of document.querySelectorAll('.js-notification-sidebar-repositories li.ActionListItem > a.ActionListContent')) {
      const repo = link.querySelector('.ActionListItem-label')?.textContent.trim().toLowerCase();
      if (!repo) continue;
      const btn = link.querySelector(`.${SHOW}`);
      if (hidden.has(repo) === !!btn) continue;
      if (btn) {
        const visual = btn.parentElement;
        btn.remove();
        if (visual.dataset.ghn && !visual.childElementCount) visual.remove();
        continue;
      }
      // Before the unread counter; repositories with nothing unread have no trailing slot
      let visual = link.querySelector('.ActionListItem-visual--trailing');
      if (!visual) {
        visual = document.createElement('span');
        visual.className = 'ActionListItem-visual ActionListItem-visual--trailing';
        visual.dataset.ghn = '1';
        link.appendChild(visual);
      }
      visual.prepend(showButton(repo));
    }
  }

  // Another tab hid or showed a repository
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    load();
    run();
  });

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; run(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  run();
})();
