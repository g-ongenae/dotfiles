// ESLint configuration for the JavaScript files of this repository.
//
// Run it through `npm run lint`, which also checks the Prettier formatting
// declared in `.prettierrc.json`. Vendored Zsh plugins under `zsh/plugins/` are
// upstream submodules and are never linted.

import js from '@eslint/js';

export default [{ ignores: ['zsh/plugins/**'] }, js.configs.recommended];
