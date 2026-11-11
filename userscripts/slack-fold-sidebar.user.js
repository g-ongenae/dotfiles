// ==UserScript==
// @name         Slack — Fold sidebar
// @namespace    https://github.com/g-ongenae/dotfiles
// @author       g-ongenae
// @version      1.0.2
// @description  Adds a button left of the back/forward arrows of Slack's top bar that folds the sidebar (workspace name, channels, DMs…) so the conversation takes its space. The choice is remembered.
// @license      MIT
// @homepageURL  https://github.com/g-ongenae/dotfiles/blob/main/userscripts/slack-fold-sidebar.user.js
// @supportURL   https://github.com/g-ongenae/dotfiles/issues
// @match        https://app.slack.com/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Settings ----------
  // Fold the sidebar on first visit. Afterwards, the last toggle state is remembered.
  const FOLDED_BY_DEFAULT = false;

  const KEY = 'sfs-sidebar-folded';
  const FOLDED = 'data-sfs-folded'; // on <html>
  const BUTTON_ID = 'sfs-sidebar-toggle';

  const stored = localStorage.getItem(KEY);
  let folded = stored === null ? FOLDED_BY_DEFAULT : stored === '1';

  // ---------- Styles ----------
  // Injected at document-start so the sidebar never flashes before being folded.
  // Slack sizes the tab panel grid columns in a <style> of its own (sidebar, conversation and, when a thread
  // is open, the thread pane). Keep its columns and let the conversation span the sidebar's column too.
  const PRIMARY = 'p-view_contents--primary';
  const style = document.createElement('style');
  style.textContent = `
    html[${FOLDED}] .p-ia4_client .p-client_workspace__tabpanel { grid-template-areas: '${PRIMARY} ${PRIMARY}' !important; }
    html[${FOLDED}] .p-ia4_client .p-client_workspace__tabpanel:has(.p-view_contents--secondary) {
      grid-template-areas: '${PRIMARY} ${PRIMARY} p-view_contents--secondary' !important;
    }
    html[${FOLDED}] .p-ia4_client .p-view_contents--sidebar,
    html[${FOLDED}] .p-ia4_client__resizer--sidebar { display: none !important; }
    #${BUTTON_ID} { display: flex; align-self: center; margin-right: 4px; }
    #${BUTTON_ID} svg { width: 20px; height: 20px; }
  `;
  (document.head || document.documentElement).appendChild(style);

  // ---------- Toggle ----------
  function apply() {
    document.documentElement.toggleAttribute(FOLDED, folded);
    const btn = document.getElementById(BUTTON_ID);
    if (btn) {
      btn.setAttribute('aria-expanded', String(!folded));
      btn.title = folded ? 'Show sidebar' : 'Hide sidebar';
      btn.setAttribute('aria-label', btn.title);
    }
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  function sidebarIcon() {
    // A window with its left pane outlined
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of [
      'M3.75 3.5h12.5c.69 0 1.25.56 1.25 1.25v10.5c0 .69-.56 1.25-1.25 1.25H3.75c-.69 0-1.25-.56-1.25-1.25V4.75c0-.69.56-1.25 1.25-1.25Z',
      'M7.5 3.5v13',
    ]) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      for (const [k, v] of Object.entries({
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '1.5',
        'stroke-linejoin': 'round',
      }))
        path.setAttribute(k, v);
      svg.appendChild(path);
    }
    return svg;
  }

  function makeButton() {
    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.type = 'button';
    // Slack's own classes, to look like the back/forward arrows beside it
    btn.className = 'c-button-unstyled p-ia4_history_buttons__button';
    btn.setAttribute('aria-disabled', 'false');
    btn.appendChild(sidebarIcon());
    btn.addEventListener('click', () => {
      folded = !folded;
      localStorage.setItem(KEY, folded ? '1' : '0');
      apply();
    });
    return btn;
  }

  // ---------- Main pass (Slack is a single-page app) ----------
  function run() {
    if (document.getElementById(BUTTON_ID)) return;
    const history = document.querySelector('.p-ia4_top_nav .p-ia4_history_buttons');
    if (!history) return;
    history.parentElement.insertBefore(makeButton(), history);
    apply();
  }

  apply();
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
