// ==UserScript==
// @name         Twitch — Followed channels on the home page
// @namespace    https://github.com/g-ongenae/dotfiles
// @author       g-ongenae
// @version      1.1.1
// @description  Replaces the Twitch home page (featured carousel, recommended streams, categories) with the channels you follow: live ones as stream cards, the others as a grid of avatars. The carousel and recommendations are not even fetched, so the carousel's live stream never plays, and the side bar keeps only the followed channels. Also hides the "More options", Prime offers, Bits and Turbo buttons of the top bar, and on channel pages the Bits, upgrade and gift sub buttons, the goals, the chat's goal and leaderboard banner and the Bits, points and bonus buttons.
// @license      MIT
// @homepageURL  https://github.com/g-ongenae/dotfiles/blob/main/userscripts/twitch-home-following.user.js
// @supportURL   https://github.com/g-ongenae/dotfiles/issues
// @match        https://www.twitch.tv/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Settings ----------
  // Hide the "More options" (⋮), Prime offers, Bits and "Try Turbo" buttons of the top bar
  const DECLUTTER_TOP_NAV = true;
  // On channel pages, hide the Bits, "Upgrade subscription" and "Gift a sub" buttons, the goals,
  // the goal and leaderboard banner atop the chat and the Bits and points balance and bonus button under it
  const DECLUTTER_CHANNEL = true;
  // Refresh the followed channels this often while the home page is open
  const REFRESH_MS = 60_000;
  // GraphQL operations of the home page that are answered empty instead of sent: the featured carousel and the recommended shelves
  const BLOCKED_OPERATIONS = ['FeaturedContentCarouselStreams', 'Shelves'];

  const GRID_ID = 'twhf-following';
  // Twitch's scroll area, on every page: on the home page, the grid replaces its content
  const MAIN = '.root-scrollable__wrapper';
  const isHome = () => location.pathname === '/';
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
    ${DECLUTTER_CHANNEL ? `
    [data-twhf-hidden],
    [data-a-target="top-nav-get-bits-button"],
    [data-a-target="manage-sub-button"],
    [data-a-target="gift-button"],
    .about-section__actions,
    /* The rotating banner atop the chat (sub goal, gift and Bits leaderboards); the messages come after it */
    .chat-room__content > div:first-child:has(.tw-transition-group):not(:has([role="log"], .chat-input)),
    [data-test-selector="community-points-summary"] { display: none !important; }
    /* Left of the chat box: the Bits and points balance and the bonus to claim; hidden, not removed, so the settings and Chat buttons stay right */
    .chat-input__buttons-container > div:first-child:not(:has([data-a-target="chat-settings"], [data-a-target="chat-send-button"])) { visibility: hidden !important; }` : ''}
    /* The side bar keeps only the followed channels: no recommended live channels, categories or "viewers also watch" */
    .side-nav-section:not(:has(.followed-side-nav-header)) { display: none !important; }
    /* Everything of the home page but the followed channels, whatever of it still renders */
    [data-a-target="front-page-carousel"],
    html[data-twhf-home] ${MAIN} > :not(#${GRID_ID}) { display: none !important; }
    #${GRID_ID} { box-sizing: border-box; max-width: 1600px; margin: 0 auto; padding: 24px 30px 32px; color: var(--color-text-base); font-family: var(--font-base, Inter, Roobert, Arial, sans-serif); }
    #${GRID_ID} .twhf-head { display: flex; align-items: baseline; gap: 16px; margin: 0 0 16px; }
    #${GRID_ID} h2 { margin: 0; font-size: 1.8rem; font-weight: 700; }
    #${GRID_ID} .twhf-head a { font-size: 1.3rem; font-weight: 600; color: var(--color-text-link); text-decoration: none; }
    #${GRID_ID} .twhf-head a:hover { text-decoration: underline; }
    #${GRID_ID} .twhf-status { margin: 0; font-size: 1.4rem; color: var(--color-text-alt); }
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

  // ---------- Hooks into Twitch's own GraphQL requests ----------
  // Run in the page through a script element, so it wraps the fetch Twitch itself calls, before Twitch's code starts
  // (twitch.tv sets no CSP). Twitch sends its GraphQL operations to gql.twitch.tv in batches:
  // - on the home page, the carousel and recommended shelves operations are answered empty instead of sent,
  //   so the carousel's live player and the recommended thumbnails never load;
  // - the side bar's answer keeps only the followed channels section, whose logins are passed to the userscript
  //   (gql.twitch.tv no longer lists your follows to an outside query: "service error").
  const FOLLOWED_EVENT = 'twhf-followed';

  function hookGraphQL(operations, followedEvent) {
    const blocked = new Set(operations);
    const pageFetch = window.fetch;
    const stub = (op) => ({ data: null, errors: [{ message: 'Blocked by a userscript' }], extensions: { operationName: op?.operationName } });
    const json = (value) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });

    function sideNav(result) {
      const sections = result?.data?.sideNav?.sections;
      if (!sections?.edges) return result;
      sections.edges = sections.edges.filter((e) => e?.node?.id?.startsWith('provider-side-nav-followed-channels'));
      const logins = sections.edges.flatMap((e) => e.node.content?.edges ?? []).map((e) => e?.node?.login).filter(Boolean);
      document.dispatchEvent(new CustomEvent(followedEvent, { detail: JSON.stringify(logins) }));
      return result;
    }

    window.fetch = function (input, init) {
      try {
        const url = typeof input === 'string' ? input : input?.url ?? String(input);
        if (!url.startsWith('https://gql.twitch.tv/gql') || typeof init?.body !== 'string') return pageFetch.call(window, input, init);
        const body = JSON.parse(init.body);
        const ops = Array.isArray(body) ? body : [body];
        const home = location.pathname === '/';
        const drop = ops.map((op) => home && blocked.has(op?.operationName));
        if (!drop.includes(true) && !ops.some((op) => op?.operationName === 'SideNav')) return pageFetch.call(window, input, init);
        // Put the answers back in the batch's order, as Twitch matches them by position
        const answer = (results) => {
          let k = 0;
          const all = ops.map((op, i) => (drop[i] ? stub(op) : op?.operationName === 'SideNav' ? sideNav(results[k++]) : results[k++]));
          return json(Array.isArray(body) ? all : all[0]);
        };
        const kept = ops.filter((_, i) => !drop[i]);
        if (!kept.length) return Promise.resolve(answer([]));
        return pageFetch.call(window, input, { ...init, body: JSON.stringify(Array.isArray(body) ? kept : kept[0]) })
          .then((res) => res.json())
          .then((results) => answer(Array.isArray(results) ? results : [results]));
      } catch {
        return pageFetch.call(window, input, init);
      }
    };
  }

  let followed = null; // logins of the side bar's followed channels, once Twitch has loaded it
  document.addEventListener(FOLLOWED_EVENT, (event) => {
    followed = JSON.parse(event.detail);
    stale = true;
    refresh(); // fetch their streams now
  });

  const script = document.createElement('script');
  script.textContent = `(${hookGraphQL})(${JSON.stringify(BLOCKED_OPERATIONS)}, ${JSON.stringify(FOLLOWED_EVENT)});`;
  (document.head || document.documentElement).appendChild(script);
  script.remove();

  // ---------- Followed channels: their streams, from Twitch's public GraphQL API ----------
  const QUERY = `query($logins: [String!]) { users(logins: $logins) {
    login displayName profileImageURL(width: 150)
    stream { title viewersCount game { displayName } previewImageURL(width: 440, height: 248) }
    lastBroadcast { startedAt } } }`;

  async function follows() {
    if (!/(?:^|;\s*)auth-token=/.test(document.cookie)) return 'Log in to see the channels you follow.';
    if (!followed) return 'Loading…'; // the side bar has not loaded yet
    const list = [];
    for (let i = 0; i < followed.length; i += 100) {
      const res = await fetch('https://gql.twitch.tv/gql', {
        method: 'POST',
        headers: { 'Client-ID': CLIENT_ID },
        body: JSON.stringify({ query: QUERY, variables: { logins: followed.slice(i, i + 100) } }),
      });
      const json = await res.json();
      const users = json?.data?.users;
      if (!users) {
        console.warn('[twitch-home-following] Followed channels unavailable', res.status, json?.errors ?? json);
        return "Couldn't load the channels you follow.";
      }
      list.push(...users.filter(Boolean));
    }
    return list;
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

  function head() {
    return el('div', { className: 'twhf-head' },
      el('h2', { textContent: 'Followed channels' }),
      el('a', { href: '/directory/following', textContent: 'Following page' }));
  }

  function build(channels) {
    // Not a list: the reason there is none (logged out, loading, API error)
    if (typeof channels === 'string') return el('section', { id: GRID_ID }, head(), el('p', { className: 'twhf-status', textContent: channels }));
    const live = channels.filter((c) => c.stream).sort((x, y) => y.stream.viewersCount - x.stream.viewersCount);
    const offline = channels.filter((c) => !c.stream)
      .sort((x, y) => (y.lastBroadcast?.startedAt ?? '').localeCompare(x.lastBroadcast?.startedAt ?? ''));
    return el('section', { id: GRID_ID },
      head(),
      ...(live.length
        ? [el('h3', { textContent: `Live (${live.length})` }), el('ul', { className: 'twhf-live' }, ...live.map(liveCard))]
        : [el('h3', { textContent: 'Nobody you follow is live' })]),
      ...(offline.length
        ? [el('h3', { textContent: `Offline (${offline.length})` }), el('ul', { className: 'twhf-offline' }, ...offline.map(offlineCard))]
        : []));
  }

  // ---------- Channel page buttons ----------
  // Hiding a button alone leaves the spacing of its wrappers: hide the outermost wrapper that holds only it
  const CHANNEL_BUTTONS = '[data-a-target="top-nav-get-bits-button"], [data-a-target="manage-sub-button"], [data-a-target="gift-button"]';

  function hideChannelButtons() {
    // React may reuse a wrapper for another button: unhide those that no longer hold one
    for (const node of document.querySelectorAll('[data-twhf-hidden]')) {
      if (!node.matches(CHANNEL_BUTTONS) && !node.querySelector(CHANNEL_BUTTONS)) delete node.dataset.twhfHidden;
    }
    for (const button of document.querySelectorAll(CHANNEL_BUTTONS)) {
      if (button.closest('[data-a-target="top-nav-container"]')) continue; // the top bar has its own rules
      let node = button;
      while (node.parentElement?.childElementCount === 1 && node.parentElement !== document.body) node = node.parentElement;
      node.dataset.twhfHidden = '';
    }
  }

  // ---------- Main pass (Twitch is an SPA) ----------
  let channels = 'Loading…';
  let fetchedAt = 0;
  let loading = false;
  let stale = false; // the side bar changed during a refresh
  let rendered = null;

  async function refresh() {
    if (loading) return;
    loading = true;
    try {
      do {
        stale = false;
        channels = await follows();
      } while (stale);
    } catch (error) {
      console.warn('[twitch-home-following] Followed channels unavailable', error);
      channels = "Couldn't load the channels you follow.";
    } finally {
      fetchedAt = Date.now();
      loading = false;
    }
    run();
  }

  function run() {
    if (DECLUTTER_CHANNEL) hideChannelButtons();
    const home = isHome();
    document.documentElement.toggleAttribute('data-twhf-home', home);
    const main = home ? document.querySelector(MAIN) : null;
    const existing = document.getElementById(GRID_ID);
    if (!main) { existing?.remove(); return; }
    if (Date.now() - fetchedAt > REFRESH_MS) refresh();
    // Should the carousel still load, its hidden player would keep playing the featured stream
    for (const video of document.querySelectorAll('[data-a-target="front-page-carousel"] video')) {
      if (!video.paused) video.pause();
    }
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
