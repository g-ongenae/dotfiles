// ==UserScript==
// @name         GitHub — README tab
// @namespace    https://github.com/g-ongenae/dotfiles
// @author       g-ongenae
// @version      1.1.0
// @description  Moves the README of GitHub repositories out of the Code tab into its own "README" tab, first in the repository navigation bar: Code shows the files only, README shows the README (and its License / Code of conduct tabs) instead of the files. The repository home opens on the README tab.
// @license      MIT
// @homepageURL  https://github.com/g-ongenae/dotfiles/blob/main/userscripts/github-readme-tab.user.js
// @supportURL   https://github.com/g-ongenae/dotfiles/issues
// @match        https://github.com/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // GitHub's own anchor for the README (the sidebar's "Readme" link): opens the README tab, so
  // the tab can be linked to and survives a reload
  const HASH = '#readme-ov-file';
  const NAV = 'nav[aria-label="Repository"]';
  const CODE_TAB = `${NAV} a[data-tab-item="code"]`;
  const TAB_ID = 'ghrt-readme-tab';
  // The README box (README / License / … tabs, then the markdown) under the files of the
  // repository home and of directories; its classes are generated, so it is found by its nav
  const README_NAV = 'nav[aria-label="Repository files"]';
  const VIEW = 'data-ghrt-readme'; // on <html> while the README tab is open
  const BOX = 'data-ghrt-box'; // the README box
  const CODE = 'data-ghrt-code'; // the branch bar, the files… hidden by the README tab
  // The path the Code tab was clicked for, which opens on the files rather than the README;
  // kept in the session should GitHub load the page in full
  const CODE_KEY = 'ghrt-code-path';

  // ---------- Styles ----------
  // Injected at document-start so the README never flashes under the files. Until the script
  // marks the box, it is matched by its structure (box > header > tabs row > nav)
  const style = document.createElement('style');
  style.textContent = `
    html:not([${VIEW}]) :is([${BOX}], div:has(> div > div > ${README_NAV})) { display: none !important; }
    html[${VIEW}] [${CODE}] { display: none !important; }
  `;
  (document.head || document.documentElement).appendChild(style);

  // ---------- Page ----------
  let readme = false;
  let path = null;

  // Mark the README box and, up to the main column, everything around it; null without a README
  function markSections() {
    const nav = document.querySelector(README_NAV);
    if (!nav) return null;
    // The box is the ancestor of the nav sitting next to the file list
    let box = nav;
    while (box.parentElement && !box.parentElement.querySelector('[data-testid="directory-content"]')) {
      box = box.parentElement;
    }
    if (!box.parentElement || box === document.body) return null;
    box.setAttribute(BOX, '');
    // Hide the siblings of each level up to the main column, whose layout also holds the sidebar
    // (kept); a few levels at most, should GitHub rename the layout
    for (let node = box, depth = 0; depth < 3; node = node.parentElement, depth++) {
      const parent = node.parentElement;
      if (!parent || parent.matches('[class*="PageLayout-Content-"]')) break;
      for (const sibling of parent.children) {
        if (sibling !== node && !sibling.hasAttribute(CODE)) sibling.setAttribute(CODE, '');
      }
    }
    return box;
  }

  function apply() {
    // Only where there is a README to show, so the other pages keep their tab
    const shown = readme && !!document.querySelector(`[${BOX}]`);
    document.documentElement.toggleAttribute(VIEW, shown);
    const tab = document.getElementById(TAB_ID);
    const code = document.querySelector(CODE_TAB);
    if (tab) {
      if (shown) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
    if (!code) return;
    if (shown && code.hasAttribute('aria-current')) {
      code.removeAttribute('aria-current');
      code.dataset.ghrtCurrent = '';
    } else if (!shown && 'ghrtCurrent' in code.dataset) {
      delete code.dataset.ghrtCurrent;
      // Give the underline back to Code, unless GitHub moved it to another tab meanwhile
      if (!document.querySelector(`${NAV} a[aria-current]:not(#${TAB_ID})`)) code.setAttribute('aria-current', 'page');
    }
  }

  // ---------- Tab ----------
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function bookIcon(template) {
    // Octicon book, with the attributes of the Code tab's icon
    const svg = document.createElementNS(SVG_NS, 'svg');
    for (const { name, value } of template?.attributes || []) svg.setAttribute(name, value);
    svg.setAttribute('class', 'octicon octicon-book');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute(
      'd',
      'M0 1.75A.75.75 0 0 1 .75 1h4.253c1.227 0 2.317.59 3 1.501A3.743 3.743 0 0 1 11.006 1h4.245a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-4.507a2.25 2.25 0 0 0-1.591.659l-.622.621a.75.75 0 0 1-1.06 0l-.622-.621A2.25 2.25 0 0 0 5.258 13H.75a.75.75 0 0 1-.75-.75Zm7.251 10.324.004-5.073-.002-2.253A2.25 2.25 0 0 0 5.003 2.5H1.5v9h3.757a3.75 3.75 0 0 1 1.994.574ZM8.755 4.75l-.004 7.322a3.752 3.752 0 0 1 1.992-.572H14.5v-9h-3.495a2.25 2.25 0 0 0-2.25 2.25Z',
    );
    svg.appendChild(path);
    return svg;
  }

  // A copy of the Code tab, so it looks native without hard-coding Primer's generated classes
  function mountTab() {
    const code = document.querySelector(CODE_TAB);
    const item = code?.closest('li');
    if (!item || document.getElementById(TAB_ID)) return;
    const clone = item.cloneNode(true);
    const link = clone.querySelector('a');
    link.id = TAB_ID;
    for (const attr of [
      'aria-current',
      'data-tab-item',
      'data-react-nav',
      'data-react-nav-anchor',
      'data-turbo-frame',
      'data-discover',
    ]) {
      link.removeAttribute(attr);
    }
    // Repository home: a plain link from the other tabs, opening the README on arrival
    link.href = code.getAttribute('href') + HASH;
    const icon = link.querySelector('svg');
    icon?.replaceWith(bookIcon(icon));
    const text = link.querySelector('[data-component="text"]') || link;
    text.textContent = 'README';
    if (text.dataset.content) text.dataset.content = 'README';
    item.before(clone);
  }

  const plainClick = (e) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

  // Capture phase, so GitHub's router never sees a click turned into a tab switch
  window.addEventListener(
    'click',
    (e) => {
      if (!plainClick(e)) return;
      const link = e.target.closest?.(`#${TAB_ID}, ${CODE_TAB}`);
      if (!link) return;
      if (link.id === TAB_ID) {
        // Other pages navigate to the repository home
        if (!document.querySelector(`[${BOX}]`)) return;
        e.preventDefault();
        readme = true;
        history.replaceState(history.state, '', HASH);
      } else {
        const target = new URL(link.href).pathname;
        if (target !== location.pathname) {
          // From the other tabs and directories, Code goes to the home, on the files
          sessionStorage.setItem(CODE_KEY, target);
          return;
        }
        if (!readme) return;
        // Already on the home: just switch back to the files
        e.preventDefault();
        readme = false;
        history.replaceState(history.state, '', location.pathname + location.search);
      }
      apply();
    },
    true,
  );

  // The sidebar's "Readme" link, or a link to the README tab
  window.addEventListener('hashchange', () => {
    if (location.hash !== HASH) return;
    readme = true;
    apply();
  });

  // ---------- Main pass (GitHub navigates with Turbo and React) ----------
  function run() {
    // The repository home opens on the README, unless reached through the Code tab; directories
    // open on the files, being browsed through, unless their URL asks for the README
    if (location.pathname !== path) {
      path = location.pathname;
      const viaCode = sessionStorage.getItem(CODE_KEY) === path;
      sessionStorage.removeItem(CODE_KEY);
      const home = path.split('/').filter(Boolean).length === 2;
      readme = location.hash === HASH || (home && !viaCode);
    }
    markSections();
    mountTab();
    apply();
  }

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      run();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
