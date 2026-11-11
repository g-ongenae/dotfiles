// ==UserScript==
// @name         Google Meet — Float call controls
// @namespace    https://github.com/g-ongenae/dotfiles
// @author       g-ongenae
// @version      1.1.2
// @description  Gives the videos the whole window in a Google Meet call: the tiles stretch to fill it, and the call controls (and the reactions row) either float over the bottom of the video, fading out when the mouse rests, or fold against the side, opening on hover. A button next to the controls switches between docked, floating and side; the choice is remembered. Also hides the Gemini button.
// @license      MIT
// @homepageURL  https://github.com/g-ongenae/dotfiles/blob/main/userscripts/google-meet-float-controls.user.js
// @supportURL   https://github.com/g-ongenae/dotfiles/issues
// @match        https://meet.google.com/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Settings ----------
  // Mode on first visit: 'float', 'side' or 'dock' (Meet's own layout). Afterwards, the last choice is remembered.
  const DEFAULT_MODE = 'float';
  // Edge the controls fold against in side mode: 'left' or 'right'
  const SIDE = 'left';
  // Floating controls fade out after the mouse rests this long, ms
  const IDLE_MS = 2500;
  // Gap left under the video once the controls no longer take their own row, px
  const STAGE_BOTTOM = 16;
  // Stretch the tiles over the whole stage instead of keeping Meet's 16:9 boxes (videos get cropped to fit;
  // screen shares are letterboxed instead)
  const FILL = true;
  // Hide the Gemini button (and its panel) at the bottom left
  const HIDE_GEMINI = true;

  const MODES = ['dock', 'float', 'side'];
  const LABELS = { dock: 'docked', float: 'floating', side: 'folded on the side' };
  const KEY = 'mcb-mode';
  const MODE = 'data-mcb-mode'; // on <html>
  const ACTIVE = 'data-mcb-active'; // on <html>, while the mouse moves
  const BAR = 'data-mcb-bar'; // the full-width bottom bar
  const CONTROLS = 'data-mcb-controls'; // its centre part: reactions row and call controls
  const EXTRA = 'data-mcb-extra'; // the parts on either side of it
  const STAGE = 'data-mcb-stage'; // <main>, where the videos are laid out
  const TILE = 'data-mcb-tile'; // a tile of <main> stretched by the script
  const FIT = 'data-mcb-fit'; // on such a tile: 'cover' or 'contain', as Meet fitted its video
  const GEMINI = 'button[jsname="J4YcA"]';
  const BUTTON_ID = 'mcb-mode-toggle';
  // Meet leaves these slots for extensions in the three parts of the bottom bar
  const CENTER_SLOT = 'browser-extension-center-buttons';
  const START_SLOT = 'browser-extension-start-buttons';

  const stored = localStorage.getItem(KEY);
  let mode = MODES.includes(stored) ? stored : DEFAULT_MODE;

  // ---------- Styles ----------
  const OFF = `html[${MODE}]:not([${MODE}="dock"])`;
  // Keep the controls shown while one of their menus is open (the reactions button is a toggle, so it
  // has aria-pressed and is left out) or while they have the keyboard focus
  const IN_USE = `:focus-visible, [aria-expanded="true"]:not([aria-pressed])`;
  const HIDDEN = `:not([${ACTIVE}])`;
  const edge = SIDE === 'right' ? 'right' : 'left';
  const style = document.createElement('style');
  style.textContent = `
    /* The videos take the row the bar was holding; Meet re-lays the tiles out when <main> resizes */
    ${OFF} main[${STAGE}] { bottom: ${STAGE_BOTTOM}px !important; }
    /* The bar spans the whole width over the video: let the mouse through it, but not through its buttons */
    ${OFF} [${BAR}] { pointer-events: none; }
    ${OFF} [${BAR}], ${OFF} [${BAR}] > *, ${OFF} [${BAR}] > * > * { background: transparent !important; }
    ${OFF} [${BAR}] :is(button, input, a, [role="button"], [role="dialog"], [role="toolbar"], [${CONTROLS}]) {
      pointer-events: auto;
    }
    /* The parts beside the controls (Gemini, chat, activities…) fade out while the mouse rests */
    ${OFF} [${BAR}] :is([${CONTROLS}], [${EXTRA}]) { transition: opacity 0.25s; }
    ${OFF}${HIDDEN} [${BAR}] [${EXTRA}]:not(:hover):not(:has(${IN_USE})) { opacity: 0; }

    /* Floating: a translucent pill over the bottom of the video */
    html[${MODE}="float"]${HIDDEN} [${CONTROLS}]:not(:hover):not(:has(${IN_USE})) { opacity: 0; }
    html[${MODE}="float"] [${CONTROLS}] {
      flex: 0 0 auto; padding: 8px 12px; border-radius: 32px;
      background: rgba(32, 33, 36, 0.78); backdrop-filter: blur(8px);
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
    }

    /* Stretched tiles: the video fills the tile, as the tile no longer has the size Meet cropped it for */
    ${OFF} [${TILE}][${FIT}] div:has(> video) {
      left: 0 !important; top: 0 !important; width: 100% !important; height: 100% !important;
    }
    ${OFF} [${TILE}][${FIT}] video {
      width: calc(100% + 2px) !important; height: calc(100% + 2px) !important; object-fit: cover;
    }
    ${OFF} [${TILE}][${FIT}="contain"] video { object-fit: contain; }

    ${HIDE_GEMINI ? `#${START_SLOT} ~ :has(${GEMINI}) { display: none !important; }` : ''}

    /* Side: folded against the edge out of sight; touching the edge opens it */
    html[${MODE}="side"] [${CONTROLS}] {
      position: fixed !important; ${edge}: 0; bottom: ${STAGE_BOTTOM}px; z-index: 1000;
      padding: 8px; padding-${SIDE === 'right' ? 'left' : 'right'}: 26px;
      border-radius: ${SIDE === 'right' ? '32px 0 0 32px' : '0 32px 32px 0'};
      background: rgba(32, 33, 36, 0.88); backdrop-filter: blur(8px);
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
      transform: translateX(calc(${SIDE === 'right' ? '100% - 18px' : '-100% + 18px'}));
      transition: transform 0.2s, opacity 0.2s;
    }
    /* Folded, only an invisible strip along the edge is left, to catch the mouse */
    html[${MODE}="side"] [${CONTROLS}]:not(:hover):not(:has(${IN_USE})) { opacity: 0; }
    html[${MODE}="side"] [${CONTROLS}]:is(:hover, :has(${IN_USE})) { transform: none; }

    #${BUTTON_ID} {
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      width: 40px; height: 40px; margin-right: 8px; padding: 0; border: none; border-radius: 50%;
      cursor: pointer; color: #e3e3e3; background: rgba(255, 255, 255, 0.12);
    }
    #${BUTTON_ID}:hover { background: rgba(255, 255, 255, 0.2); }
    #${BUTTON_ID} svg { width: 22px; height: 22px; }
  `;
  (document.head || document.documentElement).appendChild(style);

  // ---------- Mode ----------
  // A window with the controls docked under the video, floating in it, or against its side
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const BARS = {
    dock: { x: 3, y: 15, w: 18, h: 5 },
    float: { x: 7, y: 13, w: 10, h: 3 },
    side: { x: SIDE === 'right' ? 15 : 3, y: 13, w: 6, h: 3 },
  };
  function icon(m) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const frame = document.createElementNS(SVG_NS, 'rect');
    for (const [k, v] of Object.entries({
      x: 3,
      y: 4,
      width: 18,
      height: 16,
      rx: 2,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
    }))
      frame.setAttribute(k, v);
    const bar = document.createElementNS(SVG_NS, 'rect');
    const b = BARS[m];
    for (const [k, v] of Object.entries({ x: b.x, y: b.y, width: b.w, height: b.h, rx: 1, fill: 'currentColor' })) {
      bar.setAttribute(k, v);
    }
    svg.append(frame, bar);
    return svg;
  }

  function apply() {
    document.documentElement.setAttribute(MODE, mode);
    const btn = document.getElementById(BUTTON_ID);
    if (btn) {
      const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
      btn.replaceChildren(icon(mode));
      btn.title = `Call controls ${LABELS[mode]} — click to make them ${LABELS[next]}`;
      btn.setAttribute('aria-label', btn.title);
    }
    layout();
  }

  function makeButton() {
    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.type = 'button';
    btn.addEventListener('click', () => {
      mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
      localStorage.setItem(KEY, mode);
      apply();
    });
    return btn;
  }

  // ---------- Fill ----------
  // Meet places each tile of <main> in pixels, for the room it left the stage under its own bar and in
  // 16:9 boxes. Stretch that layout over the whole stage, remembering the boxes Meet gives so its next
  // layout is the one stretched.
  const meetBox = new WeakMap(); // tile → box Meet gave it
  const ourBox = new WeakMap(); // tile → box the script gave it
  const SIDES = ['left', 'top', 'width', 'height'];
  const boxOf = (el) => SIDES.map((k) => parseFloat(el.style[k]));
  const same = (a, b) => !!a && !!b && a.every((v, i) => Math.abs(v - b[i]) < 0.5);
  const setBox = (el, b) =>
    SIDES.forEach((k, i) => {
      el.style[k] = `${b[i]}px`;
    });

  let stage = null;
  function layout() {
    if (!stage) return;
    const tiles = [...stage.children].filter(
      (el) => el.style.width.endsWith('px') && el.querySelector('[data-participant-id]'),
    );
    for (const el of tiles) {
      const b = boxOf(el);
      if (!same(b, ourBox.get(el))) meetBox.set(el, b);
    }
    if (mode === 'dock' || !FILL || !tiles.length) {
      for (const el of tiles) {
        if (!ourBox.has(el)) continue;
        setBox(el, meetBox.get(el));
        ourBox.delete(el);
        el.removeAttribute(TILE);
        el.removeAttribute(FIT);
      }
      return;
    }
    const boxes = tiles.map((el) => meetBox.get(el));
    const left = Math.min(...boxes.map((b) => b[0]));
    const top = Math.min(...boxes.map((b) => b[1]));
    const width = Math.max(...boxes.map((b) => b[0] + b[2])) - left;
    const height = Math.max(...boxes.map((b) => b[1] + b[3])) - top;
    const sx = stage.clientWidth / width;
    const sy = stage.clientHeight / height;
    if (!isFinite(sx) || !isFinite(sy)) return;
    tiles.forEach((el, i) => {
      const [l, t, w, h] = boxes[i];
      const b = [(l - left) * sx, (t - top) * sy, w * sx, h * sy].map((v) => Math.round(v));
      el.setAttribute(TILE, '');
      // Meet crops a camera to its tile (the video overflows it) and letterboxes a screen share
      const media = el.querySelector('div:has(> video)');
      if (media?.style.width) {
        const over = parseFloat(media.style.width) > w + 1 || parseFloat(media.style.height) > h + 1;
        el.setAttribute(FIT, over ? 'cover' : 'contain');
      } else el.removeAttribute(FIT);
      ourBox.set(el, b);
      if (!same(b, boxOf(el))) setBox(el, b);
    });
  }

  let layoutQueued = false;
  function queueLayout() {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(() => {
      layoutQueued = false;
      layout();
    });
  }
  const stageResized = new ResizeObserver(queueLayout);
  // A tile moved, came or went, or its video was re-cropped
  const stageChanged = new MutationObserver((records) => {
    if (
      records.some(
        (r) =>
          r.target === stage || r.target.parentElement === stage || r.target.firstElementChild?.tagName === 'VIDEO',
      )
    )
      queueLayout();
  });

  // ---------- Idle fade ----------
  let idleTimer = 0;
  function wake() {
    document.documentElement.setAttribute(ACTIVE, '');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => document.documentElement.removeAttribute(ACTIVE), IDLE_MS);
  }
  window.addEventListener('pointermove', wake, { capture: true, passive: true });
  window.addEventListener('pointerdown', wake, { capture: true, passive: true });

  // ---------- Main pass (Meet swaps the page between lobby and call) ----------
  let controls = null;
  function run() {
    const slot = document.getElementById(CENTER_SLOT);
    const region = slot?.parentElement || null;
    if (region !== controls) {
      controls?.removeAttribute(CONTROLS);
      document.querySelector(`[${BAR}]`)?.removeAttribute(BAR);
      controls = region;
      if (region) {
        region.setAttribute(CONTROLS, '');
        // The bar is the panel Meet pins to the bottom edge, whatever sits between it and the controls
        let bar = region.closest('[data-side]');
        if (!bar) {
          bar = region;
          while (bar.parentElement && getComputedStyle(bar).position !== 'absolute') bar = bar.parentElement;
        }
        bar.setAttribute(BAR, '');
      }
    }
    for (const part of region?.parentElement?.children || []) {
      if (part !== region && !part.hasAttribute(EXTRA)) part.setAttribute(EXTRA, '');
    }
    const main = document.querySelector('main');
    if (main !== stage) {
      stageResized.disconnect();
      stageChanged.disconnect();
      stage = main;
      if (main) {
        main.setAttribute(STAGE, '');
        stageResized.observe(main);
        stageChanged.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
        queueLayout();
      }
    }
    if (slot && !document.getElementById(BUTTON_ID)) {
      slot.appendChild(makeButton());
      apply();
    }
  }

  apply();
  wake();
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      run();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
