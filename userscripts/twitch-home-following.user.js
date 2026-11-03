// ==UserScript==
// @name         Twitch — Followed channels on the home page
// @namespace    https://github.com/g-ongenae/dotfiles
// @version      1.0.0
// @description  Replaces the Twitch home page (featured carousel, recommended streams, categories) with the channels you follow: live ones as stream cards, the others as a grid of avatars. Also hides the "More options", Prime offers, Bits and Turbo buttons of the top bar.
// @match        https://www.twitch.tv/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Settings ----------
  // Hide the "More options" (⋮), Prime offers, Bits and "Try Turbo" buttons of the top bar
  const DECLUTTER_TOP_NAV = true;
  // Refresh the followed channels this often while the home page is open
  const REFRESH_MS = 60_000;

  const GRID_ID = 'twhf-following';
  const MAIN = '#front-page-main-content';
  const AVATAR = 88; // px
  // Twitch's public web client ID: the site sends it with every GraphQL request
  const CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

  // ---------- Styles ----------
  const style = document.createElement('style');
  style.textContent = `
    ${DECLUTTER_TOP_NAV ? `
    [data-a-target="top-nav-container"] [data-a-target="ellipsis-button"],
    [data-a-target="top-nav-container"] [data-a-target="prime-offers-icon"],
    [data-a-target="top-nav-container"] [data-a-target="top-nav-get-bits-button"],
    /* The Turbo button is the only labelled button of the top bar once logged in (logged out, those are Log in / Sign up) */
    html:has([data-a-target="top-nav-avatar"]) [data-a-target="top-nav-container"] button:has([data-a-target="tw-core-button-label-text"]) { display: none !important; }` : ''}
    /* Once the followed channels are in, hide everything else of the home page */
    html:has(#${GRID_ID}) [data-a-target="front-page-carousel"],
    html:has(#${GRID_ID}) ${MAIN} > :not(#${GRID_ID}) { display: none !important; }
    #${GRID_ID} { padding: 24px 0 32px; color: var(--color-text-base); font-family: var(--font-base, Inter, Roobert, Arial, sans-serif); }
    #${GRID_ID} .twhf-head { display: flex; align-items: baseline; gap: 16px; margin: 0 0 16px; }
    #${GRID_ID} h2 { margin: 0; font-size: 1.8rem; font-weight: 700; }
    #${GRID_ID} .twhf-head a { font-size: 1.3rem; font-weight: 600; color: var(--color-text-link); text-decoration: none; }
    #${GRID_ID} .twhf-head a:hover { text-decoration: underline; }
    #${GRID_ID} h3 { margin: 24px 0 12px; font-size: 1.4rem; font-weight: 600; color: var(--color-text-alt); }
    #${GRID_ID} ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 16px; }
    #${GRID_ID} a { color: inherit; text-decoration: none; }

    /* Live: stream cards */
    #${GRID_ID} .twhf-live { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
    #${GRID_ID} .twhf-thumb { position: relative; display: block; aspect-ratio: 16 / 9; border-radius: 6px; overflow: hidden; background: var(--color-background-alt); }
    #${GRID_ID} .twhf-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.1s; }
    #${GRID_ID} .twhf-thumb:hover img { transform: scale(1.03); }
    #${GRID_ID} .twhf-badge, #${GRID_ID} .twhf-viewers {
      position: absolute; padding: 0 5px; border-radius: 4px; font-size: 1.3rem; font-weight: 600; line-height: 2rem;
    }
    #${GRID_ID} .twhf-badge { top: 8px; left: 8px; background: #eb0400; color: #fff; text-transform: uppercase; }
    #${GRID_ID} .twhf-viewers { bottom: 8px; left: 8px; background: rgba(0, 0, 0, 0.6); color: #fff; }
    #${GRID_ID} .twhf-meta { display: flex; gap: 10px; margin-top: 10px; }
    #${GRID_ID} .twhf-meta img { width: 40px; height: 40px; border-radius: 50%; flex: none; }
    #${GRID_ID} .twhf-meta div { min-width: 0; font-size: 1.3rem; line-height: 1.8rem; }
    #${GRID_ID} .twhf-meta p { margin: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--color-text-alt); }
    #${GRID_ID} .twhf-meta .twhf-title { font-size: 1.4rem; font-weight: 600; color: var(--color-text-base); }

    /* Offline: avatars */
    #${GRID_ID} .twhf-offline { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
    #${GRID_ID} .twhf-offline a { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px 6px; border-radius: 8px; }
    #${GRID_ID} .twhf-offline a:hover { background: var(--color-background-button-secondary-default, rgba(0, 0, 0, 0.05)); }
    #${GRID_ID} .twhf-offline img { width: ${AVATAR}px; height: ${AVATAR}px; border-radius: 50%; object-fit: cover; background: var(--color-background-alt); }
    #${GRID_ID} .twhf-name { font-size: 1.4rem; font-weight: 600; text-align: center; max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    #${GRID_ID} .twhf-since { font-size: 1.2rem; color: var(--color-text-alt); margin-top: -6px; }
  `;
  (document.head || document.documentElement).appendChild(style);

  // ---------- Followed channels, from Twitch's GraphQL API with the session of the page ----------
  const QUERY = `query($after: Cursor) { currentUser { follows(first: 100, after: $after) {
    edges { cursor node { login displayName profileImageURL(width: 150)
      stream { title viewersCount game { displayName } previewImageURL(width: 440, height: 248) }
      lastBroadcast { startedAt } } }
    pageInfo { hasNextPage } } } }`;

  const token = () => document.cookie.match(/(?:^|;\s*)auth-token=([^;]+)/)?.[1];

  async function follows() {
    const auth = token();
    if (!auth) return null; // logged out: keep Twitch's home page
    // In a Firefox content script, content.fetch sends the request as the page, which CORS expects
    const request = globalThis.content?.fetch?.bind(globalThis.content) ?? fetch;
    const channels = [];
    let after = null;
    for (let page = 0; page < 20; page++) {
      const res = await request('https://gql.twitch.tv/gql', {
        method: 'POST',
        headers: { 'Client-ID': CLIENT_ID, Authorization: `OAuth ${auth}` },
        body: JSON.stringify({ query: QUERY, variables: { after } }),
      });
      const f = (await res.json())?.data?.currentUser?.follows;
      if (!f) return channels.length ? channels : null;
      channels.push(...f.edges.map((e) => e.node).filter(Boolean));
      if (!f.pageInfo?.hasNextPage || !f.edges.length) break;
      after = f.edges.at(-1).cursor;
    }
    return channels;
  }

  // ---------- Grid ----------
  function el(tag, props = {}, ...children) {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
  }

  const number = new Intl.NumberFormat(undefined, { notation: 'compact' });
  const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  function since(iso) {
    if (!iso) return '';
    const days = Math.round((Date.parse(iso) - Date.now()) / 86_400_000);
    if (days > -1) return relative.format(Math.round((Date.parse(iso) - Date.now()) / 3_600_000), 'hour');
    if (days > -30) return relative.format(days, 'day');
    if (days > -365) return relative.format(Math.round(days / 30), 'month');
    return relative.format(Math.round(days / 365), 'year');
  }

  function liveCard(c) {
    const href = `/${c.login}`;
    // Cache-bust the preview so a refresh shows a current frame
    const preview = `${c.stream.previewImageURL}?t=${Math.floor(Date.now() / REFRESH_MS)}`;
    return el('li', {},
      el('a', { className: 'twhf-thumb', href, title: c.stream.title },
        el('img', { src: preview, alt: '', loading: 'lazy' }),
        el('span', { className: 'twhf-badge', textContent: 'Live' }),
        el('span', { className: 'twhf-viewers', textContent: `${number.format(c.stream.viewersCount)} viewers` })),
      el('div', { className: 'twhf-meta' },
        el('a', { href }, el('img', { src: c.profileImageURL, alt: '', loading: 'lazy' })),
        el('div', {},
          el('a', { href, title: c.stream.title }, el('p', { className: 'twhf-title', textContent: c.stream.title || c.displayName })),
          el('a', { href }, el('p', { textContent: c.displayName })),
          el('p', { textContent: c.stream.game?.displayName ?? '' }))));
  }

  function offlineCard(c) {
    const last = c.lastBroadcast?.startedAt;
    return el('li', {},
      el('a', { href: `/${c.login}`, title: last ? `${c.displayName} — last live ${since(last)}` : c.displayName },
        el('img', { src: c.profileImageURL, alt: '', loading: 'lazy' }),
        el('span', { className: 'twhf-name', textContent: c.displayName }),
        el('span', { className: 'twhf-since', textContent: since(last) })));
  }

  function build(channels) {
    const live = channels.filter((c) => c.stream).sort((x, y) => y.stream.viewersCount - x.stream.viewersCount);
    const offline = channels.filter((c) => !c.stream)
      .sort((x, y) => (y.lastBroadcast?.startedAt ?? '').localeCompare(x.lastBroadcast?.startedAt ?? ''));
    return el('section', { id: GRID_ID },
      el('div', { className: 'twhf-head' },
        el('h2', { textContent: 'Followed channels' }),
        el('a', { href: '/directory/following', textContent: 'Following page' })),
      ...(live.length
        ? [el('h3', { textContent: `Live (${live.length})` }), el('ul', { className: 'twhf-live' }, ...live.map(liveCard))]
        : [el('h3', { textContent: 'Nobody you follow is live' })]),
      ...(offline.length
        ? [el('h3', { textContent: `Offline (${offline.length})` }), el('ul', { className: 'twhf-offline' }, ...offline.map(offlineCard))]
        : []));
  }

  // ---------- Main pass (Twitch is an SPA) ----------
  let channels = null;
  let fetchedAt = 0;
  let loading = false;
  let rendered = null;

  async function refresh() {
    if (loading) return;
    loading = true;
    try {
      channels = await follows();
    } catch {
      channels = null; // network or API change: Twitch's own home page stays
    } finally {
      fetchedAt = Date.now();
      loading = false;
    }
    run();
  }

  function run() {
    const main = document.querySelector(MAIN);
    const existing = document.getElementById(GRID_ID);
    if (!main) { existing?.remove(); return; }
    if (Date.now() - fetchedAt > REFRESH_MS) refresh();
    // The hidden carousel would keep playing its featured stream
    for (const video of document.querySelectorAll('[data-a-target="front-page-carousel"] video')) {
      if (existing && !video.paused) video.pause();
    }
    if (!channels) return;
    if (existing && existing.parentNode === main && rendered === channels) return;
    existing?.remove();
    rendered = channels;
    main.append(build(channels)); // appended, not inserted, so React's own children keep their places
  }

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; run(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(run, REFRESH_MS);
  run();
})();
