// ESLint configuration for the JavaScript files of this repository.
//
// Run it through `npm run lint`, which also checks the Prettier formatting
// declared in `.prettierrc.json`. Vendored Zsh plugins under `zsh/plugins/` are
// upstream submodules and are never linted.

import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['zsh/plugins/**'] },
  js.configs.recommended,
  {
    // Userscripts are classic scripts injected into a page by Violentmonkey.
    // They all declare `@grant none`, so no GM_* global is available to them.
    files: ['userscripts/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.browser,
        // Firefox gives content scripts this helper to hand a function to the page.
        exportFunction: 'readonly',
      },
    },
  },
];
