// ==UserScript==
// @namespace    https://greasyfork.org/users/297963
// @name         GitHub - Find active Forks button
// @author       Celuni
// @description  Adds a button to find active Forks
// @version      2.1.1
// @match        https://github.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const BUTTON_ID = 'find-active-forks';
  const FORK_ICON =
    '<svg aria-hidden="true" focusable="false" class="octicon octicon-repo-forked" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style="vertical-align:text-bottom">' +
    '<path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z"/>' +
    '</svg>';

  const getRepo = () => {
    const [owner, repo] = location.pathname.split('/').filter(Boolean);
    return owner && repo ? `${owner}/${repo}` : null;
  };

  // Current React header first, legacy header (e.g. GitHub Enterprise) as a fallback.
  const findActionsList = () =>
    document.querySelector('ul[data-testid="repo-header-actions"]') ??
    document.querySelector('#repository-container-header ul.pagehead-actions') ??
    document.querySelector('ul.pagehead-actions');

  // Copy the classes of GitHub's own Fork button so ours looks native,
  // without hard-coding Primer's generated class names.
  const classOf = (root, selector) => root?.querySelector(selector)?.className ?? '';

  const buildButton = (actions, href) => {
    const reference =
      actions.querySelector('[data-testid="fork-button"]') ?? actions.querySelector('[data-component="Button"]');

    const link = document.createElement('a');
    link.id = BUTTON_ID;
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = 'Find active forks (techgaun/active-forks)';

    if (reference) {
      link.className = reference.className;
      link.dataset.component = 'Button';
      link.dataset.size = reference.dataset.size ?? 'small';
      link.dataset.variant = reference.dataset.variant ?? 'default';
      link.innerHTML =
        `<span data-component="buttonContent" class="${classOf(reference, '[data-component="buttonContent"]')}">` +
        `<span data-component="leadingVisual" class="${classOf(reference, '[data-component="leadingVisual"]')}">${FORK_ICON}</span>` +
        `<span data-component="text" class="${classOf(reference, '[data-component="text"]')}">Active forks</span>` +
        '</span>';
    } else {
      // Legacy header
      link.className = 'btn btn-sm';
      link.innerHTML = `${FORK_ICON} Active forks`;
    }

    const li = document.createElement('li');
    li.append(link);
    return li;
  };

  const inject = () => {
    const actions = findActionsList();
    const repo = getRepo();
    if (!actions || !repo) return;

    const href = `https://techgaun.github.io/active-forks/index.html#${repo}`;

    const existing = document.getElementById(BUTTON_ID);
    if (existing && actions.contains(existing)) {
      if (existing.getAttribute('href') !== href) existing.href = href;
      return;
    }
    existing?.closest('li')?.remove();

    actions.append(buildButton(actions, href));
  };

  // GitHub navigates without full page loads and React re-renders the header,
  // so watch the DOM and re-inject whenever our button disappears.
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      inject();
    });
  }).observe(document.body, { childList: true, subtree: true });

  document.addEventListener('turbo:load', inject);
  inject();
})();
