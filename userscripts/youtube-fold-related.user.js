// ==UserScript==
// @name         YouTube — Fold related videos
// @namespace    https://github.com/g-ongenae/dotfiles
// @author       g-ongenae
// @version      1.1.1
// @description  Folds the right column of a YouTube video (filter chips and related videos) so the video takes its space; a small round button on the right edge unfolds it. The choice is remembered.
// @match        https://www.youtube.com/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Settings ----------
  // Fold the recommendations on first visit. Afterwards, the last toggle state is remembered.
  const FOLDED_BY_DEFAULT = true;

  const KEY = 'ytf-related-folded';
  const FOLDED = 'data-ytf-folded'; // on <html>
  const WATCH = 'data-ytf-watch'; // on <html>, on /watch pages
  const BUTTON_ID = 'ytf-related-toggle';
  const SIZE = 28; // button diameter, px
  // Something the user opened on purpose keeps the column visible while folded
  const IN_USE = [
    'ytd-engagement-panel-section-list-renderer[visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"]',
    '#playlist:not([hidden])',
    '#chat:not([hidden]):not([collapsed])',
  ].join(', ');

  const stored = localStorage.getItem(KEY);
  let folded = stored === null ? FOLDED_BY_DEFAULT : stored === '1';

  // ---------- Styles ----------
  // Injected at document-start so the column never flashes before being folded
  const style = document.createElement('style');
  style.textContent = `
    html[${FOLDED}] ytd-watch-flexy ytd-watch-next-secondary-results-renderer,
    html[${FOLDED}] ytd-watch-flexy #player-ads,
    html[${FOLDED}] ytd-watch-flexy #secondary:not(:has(${IN_USE})) { display: none !important; }
    /* Keep the right edge clear for the button, so it never covers the video or a thumbnail */
    html[${WATCH}] ytd-watch-flexy[is-two-columns_] #columns { padding-right: ${SIZE + 8}px !important; }
    #${BUTTON_ID} {
      display: none; position: fixed; z-index: 2000;
      top: calc(var(--ytd-masthead-height, 56px) + 12px); right: 6px;
      width: ${SIZE}px; height: ${SIZE}px; padding: 0; border: none; border-radius: 50%;
      align-items: center; justify-content: center; cursor: pointer;
      color: var(--yt-spec-text-primary, #0f0f0f);
      background: var(--yt-spec-badge-chip-background, rgba(0, 0, 0, 0.05));
    }
    html[${WATCH}] #${BUTTON_ID} { display: flex; }
    #${BUTTON_ID}:hover { background: var(--yt-spec-button-chip-background-hover, rgba(0, 0, 0, 0.1)); }
    #${BUTTON_ID} svg { width: 16px; height: 16px; transition: transform 0.15s; }
    html[${FOLDED}] #${BUTTON_ID} svg { transform: rotate(180deg); }
  `;
  (document.head || document.documentElement).appendChild(style);

  // ---------- Toggle ----------
  function apply() {
    document.documentElement.toggleAttribute(FOLDED, folded);
    const btn = document.getElementById(BUTTON_ID);
    if (btn) {
      btn.setAttribute('aria-expanded', String(!folded));
      btn.title = folded ? 'Show related videos' : 'Hide related videos';
      btn.setAttribute('aria-label', btn.title);
    }
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  function chevron() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'M7 4l6 6-6 6'); // › : push the column out; rotated ‹ to pull it back
    for (const [k, v] of Object.entries({
      fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    })) path.setAttribute(k, v);
    svg.appendChild(path);
    return svg;
  }

  function makeButton() {
    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.type = 'button';
    btn.appendChild(chevron());
    btn.addEventListener('click', () => {
      folded = !folded;
      localStorage.setItem(KEY, folded ? '1' : '0');
      apply();
    });
    return btn;
  }

  // ---------- Player size ----------
  // The player sizes the video in pixels on window resize only: tell it when the column width changes
  let primary = null;
  let lastWidth = 0;
  const resized = new ResizeObserver(([entry]) => {
    const w = Math.round(entry.contentRect.width);
    if (w === lastWidth) return;
    lastWidth = w;
    window.dispatchEvent(new Event('resize'));
  });

  // ---------- Main pass (YouTube is an SPA) ----------
  function run() {
    document.documentElement.toggleAttribute(WATCH, location.pathname === '/watch');
    if (document.body && !document.getElementById(BUTTON_ID)) {
      document.body.appendChild(makeButton());
      apply();
    }
    const p = document.querySelector('ytd-watch-flexy #primary');
    if (p !== primary) {
      if (primary) resized.unobserve(primary);
      if (p) resized.observe(p);
      primary = p;
      lastWidth = 0;
    }
  }

  apply();
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; run(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('yt-navigate-finish', run);
})();
