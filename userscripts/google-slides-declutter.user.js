// ==UserScript==
// @name         Google Slides — Declutter the editor
// @namespace    https://github.com/g-ongenae/dotfiles
// @author       g-ongenae
// @version      1.2.0
// @description  Gives the slide more room in the Google Slides editor: folds away the insert rail on the right (Slide, Image, Media, Uploads, Convert to video — all still in the Insert menu) and hands its room to the slide, with a chevron at the end of the toolbar to bring it back (the choice is remembered); closes the "Enhance this slide" AI button under the slide whenever it shows up.
// @license      MIT
// @homepageURL  https://github.com/g-ongenae/dotfiles/blob/main/userscripts/google-slides-declutter.user.js
// @supportURL   https://github.com/g-ongenae/dotfiles/issues
// @match        https://docs.google.com/presentation/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Settings ----------
  // Fold the insert rail on first visit. Afterwards, the panel button toggles it and the last state is remembered.
  const FOLD_RAIL_BY_DEFAULT = true;
  // Close the "Enhance this slide" AI button under the slide
  const CLOSE_AI_NUDGE = true;

  const RAIL = '.appsSketchyContentLibraryRailContainerRefreshed';
  const NUDGE = '#canvas-nudge-surface-soy-container';
  const NUDGE_CLOSE = `${NUDGE} .appsElementsGenerativeAiNudgeButtonNudgeDismissButton`;
  const MENUS_TOGGLE = '#viewModeButton'; // the ⌄ ending the toolbar, the fold button goes after it
  const KEY = 'gsd-rail-folded';
  const FOLDED = 'data-gsd-rail-folded'; // on <html>
  const BUTTON_ID = 'gsd-fold-rail';
  // Slides keeps 88px on the right for the rail, unless this element (its AI deck generation sidebar,
  // while it loads) is in the page: then it keeps that element's width. A 1px stand-in gives the room back.
  const STAND_IN_ID = 'deckgen-loading-sidebar';

  const stored = localStorage.getItem(KEY);
  let folded = stored === null ? FOLD_RAIL_BY_DEFAULT : stored === '1';

  // ---------- Styles ----------
  const style = document.createElement('style');
  style.textContent = `
    html[${FOLDED}] ${RAIL} { display: none !important; }
    ${CLOSE_AI_NUDGE ? `${NUDGE} { display: none !important; }` : ''}
    #${STAND_IN_ID} {
      position: fixed !important; top: 0 !important; left: 0 !important; width: 1px !important; height: 0 !important;
      visibility: hidden !important; pointer-events: none !important;
    }
    #${BUTTON_ID} {
      /* At the end of the toolbar, looking like the filmstrip toggle at the bottom left */
      display: inline-flex; align-items: center; justify-content: center; vertical-align: middle;
      width: 28px; height: 28px; margin: 0 0 0 2px; padding: 0; border: none; border-radius: 9999px;
      background: transparent; color: var(--gm3-sys-color-on-surface-variant, #444746); cursor: pointer;
    }
    #${BUTTON_ID}:hover, #${BUTTON_ID}:focus-visible {
      background: color-mix(in srgb, var(--gm3-sys-color-on-surface, #1f1f1f) 8%, transparent);
    }
    /* No toolbar to sit in: top right of the window */
    body > #${BUTTON_ID} { position: fixed; z-index: 1000; top: 8px; right: 8px; }
    #${BUTTON_ID} svg { width: 20px; height: 20px; transition: transform 0.3s; }
    /* > folds the rail away to the right, < brings it back */
    html[${FOLDED}] #${BUTTON_ID} svg { transform: rotate(180deg); }
  `;
  (document.head || document.documentElement).appendChild(style);

  // ---------- Layout ----------
  // Slides only lays the editor out again when the window size changes: report a viewport 1px narrower,
  // then the real one, so that it measures the room left for the slide twice and ends up with the right size.
  let pending = 0;
  const relayout = () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => {
      // The page's own view of <html> (Firefox runs the script in a sandbox when the page's CSP blocks
      // injection); a plain value crosses over where a getter would not
      const root = document.documentElement.wrappedJSObject || document.documentElement;
      Object.defineProperty(root, 'clientWidth', { configurable: true, value: root.clientWidth - 1 });
      try {
        window.dispatchEvent(new Event('resize'));
      } finally {
        delete root.clientWidth;
      }
      window.dispatchEvent(new Event('resize'));
    });
  };

  // ---------- Fold button ----------
  // The > chevron of the filmstrip toggle
  const CHEVRON = 'm8 15-1.062-1.062L10.875 10 6.938 6.062 8 5l5 5Z';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function icon() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', CHEVRON);
    path.setAttribute('fill', 'currentColor');
    svg.appendChild(path);
    return svg;
  }

  let button = null;

  /** Put the button after the ⌄ of the toolbar, or in the window corner when there is none. */
  function place() {
    const anchor = document.querySelector(MENUS_TOGGLE);
    if (anchor) {
      if (anchor.nextElementSibling !== button) anchor.after(button);
    } else if (button.parentElement !== document.body) {
      document.body.appendChild(button);
    }
  }

  function applyFold() {
    document.documentElement.toggleAttribute(FOLDED, folded);
    let standIn = document.getElementById(STAND_IN_ID);
    if (folded && !standIn && button) {
      standIn = document.createElement('div');
      standIn.id = STAND_IN_ID;
      document.body.appendChild(standIn);
    } else if (!folded && standIn) {
      standIn.remove();
    }
    if (!button) return;
    button.title = `${folded ? 'Show' : 'Hide'} the insert rail`;
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-expanded', String(!folded));
  }

  function addButton() {
    button = document.createElement('button');
    button.type = 'button';
    button.id = BUTTON_ID;
    button.appendChild(icon());
    // Keep the click away from the toolbar, which handles its own buttons' clicks
    for (const type of ['pointerdown', 'mousedown', 'mouseup']) button.addEventListener(type, (e) => e.stopPropagation());
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      folded = !folded;
      localStorage.setItem(KEY, folded ? '1' : '0');
      applyFold();
      relayout();
    });
    place();
    applyFold();
  }

  // ---------- Watch ----------
  // Relayout once per new rail or nudge, as Slides renders them after the first layout
  const seen = new WeakSet();
  const sweep = () => {
    if (!document.body) return;
    let changed = false;
    const rail = document.querySelector(RAIL);
    if (rail && !button) addButton();
    // Slides may rebuild the body's children: put the stand-in back
    if (folded && button && !document.getElementById(STAND_IN_ID)) {
      applyFold();
      changed = true;
    }
    // Slides may rebuild its toolbar: follow its ⌄
    if (button) place();
    for (const el of document.querySelectorAll(CLOSE_AI_NUDGE ? `${RAIL}, ${NUDGE}` : RAIL)) {
      if (seen.has(el)) continue;
      seen.add(el);
      changed = true;
    }
    // Dismissing the nudge (rather than only hiding it) tells Slides to stop offering it
    if (CLOSE_AI_NUDGE) for (const close of document.querySelectorAll(NUDGE_CLOSE)) close.click();
    if (changed) relayout();
  };

  new MutationObserver(sweep).observe(document.documentElement, { childList: true, subtree: true });
  sweep();
})();
