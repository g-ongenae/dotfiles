// @ts-check

/**
 * @typedef {import('/Applications/Finicky.app/Contents/Resources/finicky.d.ts').FinickyConfig} FinickyConfig
 */

/**
 * List of Apps installed on my computer
 * which are accessible through https? request
 */
const Apps = {
  SLACK: "Slack",
  // @not-installed
  // FIGMA: "Figma",
  // NOTION: "Notion",
};

/**
 * List of browser installed on my computer
 */
const Browsers = {
  BRAVE: "Brave Browser",
  LIBRE_WOLF: "LibreWolf",
  SAFARI: "Safari",
  // @not-installed
  // BLISK: "Blisk", // (blisk.io)
  // CHROMIUM: "Chromium",
  // CHROME: "Google Chrome",
  // FIREFOX: "Firefox",
  // MIN: "Min Browser", // (minbrowser.org)
  // TOR: "Tor Browser",
  // VIVALDI: "Vivaldi",
};

/**
 * @type {FinickyConfig}
 */
export default {
  // Browser with the most privacy
  // See: https://privacytests.org/
  defaultBrowser: Browsers.LIBRE_WOLF,
  rewrite: [
    {
      // Redirect all urls to use https
      match: (url) => url.protocol === "http",
      url: (url) => { url.protocol = "https"; return url; },
    },
    {
      // Redirect all urls to use https
      match: /^https?:\/\/localhost.*$/,
      url: (url) => { url.protocol = "http"; return url; },
    },
  ],
  handlers: [
    {
      browser: Apps.SLACK,
      match: ["*.slack.com*"],
    },
    {
      // To override specific handlers with more specific handler
      // redirecting it to the default browser
      browser: Browsers.LIBRE_WOLF,
      match: [],
    },
    {
      // Default connected browser
      browser: Browsers.BRAVE,
      match: [
        "https://app.datadoghq.eu*",
        "*github.com*",
        "www.linkedin.com*",
        "docs.google.com*",
        "drive.google.com*",
        "console.cloud.google.com*",
        "www.google.com/calendar/event*",
        "calendar.google.com*",
        "meet.google.com*",
        "www.figma.com*",
        "www.grammarly.com*",
        "twitch.tv*",
      ],
    },
    {
      browser: Browsers.SAFARI,
      match: [],
    },
  ],
};
