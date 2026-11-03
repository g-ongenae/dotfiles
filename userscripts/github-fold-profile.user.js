// ==UserScript==
// @name         GitHub — Fold profile sections
// @namespace    https://github.com/g-ongenae/dotfiles
// @version      1.1.0
// @description  Folds the README and the pinned repositories on GitHub user and organization profiles down to their headers; a chevron button in each header unfolds it (next to the edit pencil on your own README). Each choice is remembered.
// @match        https://github.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Settings ----------
  // Fold on first visit. Afterwards, the last toggle state of each section is remembered.
  const FOLDED_BY_DEFAULT = { readme: true, pinned: false };

  // User profile frame, or the main column of an organization page
  const PROFILE = ':is(#user-profile-frame, main:has(.orghead))';
  // README box: "user / README.md" header row (with the edit pencil on your own profile), then the markdown
  const README = `${PROFILE} .Box:has(> .Box-body > article.markdown-body)`;
  // Pinned repositories: "Pinned" heading, then the list of cards. On organizations, an outer
  // container with the same class also wraps the README, hence the heading requirement.
  const PINNED = `${PROFILE} .js-pinned-items-reorder-container:has(> h2)`;
  const SECTIONS = [
    {
      name: 'readme',
      label: 'README',
      hidden: `${README} > .Box-body > article.markdown-body`,
      extra: `${README} > .Box-body > .d-flex > div { margin-bottom: 0 !important; }`,
      // Right of the header, after the edit pencil when there is one
      mount(btn) {
        const header = document.querySelector(`${README} > .Box-body > .d-flex`);
        if (!header) return false;
        let actions = header.children[1];
        if (!actions) {
          actions = document.createElement('div');
          actions.className = 'text-small tmp-mb-3';
          header.appendChild(actions);
        }
        actions.classList.add('d-flex', 'flex-items-center');
        actions.appendChild(btn);
        return true;
      },
    },
    {
      name: 'pinned',
      label: 'pinned repositories',
      hidden: `${PINNED} ol, ${PINNED} .js-pinned-items-reorder-form`,
      extra: '',
      // Right after the "Pinned" heading text
      mount(btn) {
        const heading = document.querySelector(`${PINNED} > h2`);
        if (!heading) return false;
        heading.insertBefore(btn, heading.querySelector('.spinner')?.parentElement || null);
        return true;
      },
    },
  ];

  for (const s of SECTIONS) {
    s.key = `ghf-${s.name}-folded`;
    s.attr = `data-ghf-${s.name}-folded`; // on <html>
    s.id = `ghf-${s.name}-toggle`;
    const stored = localStorage.getItem(s.key);
    s.folded = stored === null ? FOLDED_BY_DEFAULT[s.name] : stored === '1';
  }

  // ---------- Styles ----------
  // Injected at document-start so a folded section never flashes before being hidden
  const style = document.createElement('style');
  style.textContent = SECTIONS.map((s) => `
    ${s.hidden.split(', ').map((sel) => `html[${s.attr}] ${sel}`).join(', ')} { display: none !important; }
    ${s.extra ? `html[${s.attr}] ${s.extra}` : ''}
    #${s.id} { margin-left: 4px; vertical-align: middle; }
    #${s.id} svg { transition: transform 0.15s; }
    html[${s.attr}] #${s.id} svg { transform: rotate(-90deg); }
  `).join('');
  (document.head || document.documentElement).appendChild(style);

  // ---------- Toggle ----------
  function apply(s) {
    document.documentElement.toggleAttribute(s.attr, s.folded);
    const btn = document.getElementById(s.id);
    if (btn) {
      btn.setAttribute('aria-expanded', String(!s.folded));
      btn.title = `${s.folded ? 'Show' : 'Hide'} ${s.label}`;
      btn.setAttribute('aria-label', btn.title);
    }
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

  function makeButton(s) {
    const btn = document.createElement('button');
    btn.id = s.id;
    btn.type = 'button';
    btn.className = 'Box-btn-octicon btn-octicon';
    btn.appendChild(chevron());
    btn.addEventListener('click', () => {
      s.folded = !s.folded;
      localStorage.setItem(s.key, s.folded ? '1' : '0');
      apply(s);
    });
    return btn;
  }

  // ---------- Main pass (GitHub navigates with Turbo) ----------
  function run() {
    for (const s of SECTIONS) {
      if (document.getElementById(s.id)) continue;
      const btn = makeButton(s);
      if (s.mount(btn)) apply(s);
    }
  }

  SECTIONS.forEach(apply);
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; run(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
