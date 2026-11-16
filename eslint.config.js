// @ts-check
// ESLint flat config (ESLint 10 and angular-eslint 22 no longer read .eslintrc.json).
// Same rules as the old .eslintrc.json. The "node/..." and "jsdoc/..." rules it turned off are gone
// because those plugins were never loaded, and flat config rejects rules from unloaded plugins.
const globals = require("globals");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");
const prettierRecommended = require("eslint-plugin-prettier/recommended");

module.exports = tseslint.config(
  {
    ignores: [
      "projects/**/*",
      "app/ui_compiled/**/*",
      "app/app_compiled/**/*",
      "app/src/rollbarConfig.js",
      "app/src/rpcChannels.js",
      "app/src/storageConfig.js",
      "ui/environments/environment.build.ts",
    ],
  },
  {
    // The old config didn't report stale eslint-disable comments; keep it that way
    linterOptions: { reportUnusedDisableDirectives: "off" },
  },
  {
    // Electron main process
    files: ["**/*.js"],
    extends: [prettierRecommended],
    languageOptions: {
      sourceType: "module",
      ecmaVersion: 2020,
      globals: { ...globals.node, ...globals.es2015 },
    },
    rules: {
      "comma-dangle": ["error", "always-multiline"],
      "func-style": ["error", "expression"],
      "lines-around-comment": ["off"],
      semi: ["error", "always"],
      "no-new": ["off"],
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  {
    // Angular UI
    files: ["**/*.ts"],
    extends: [...tseslint.configs.recommendedTypeChecked, ...angular.configs.tsRecommended, prettierRecommended],
    processor: angular.processInlineTemplates,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "class-methods-use-this": ["off"],
      "comma-dangle": ["error", "always-multiline"],
      "func-style": ["error", "expression"],
      "lines-around-comment": ["off"],
      semi: ["error", "always"],
      "new-cap": ["off"],
      "no-invalid-this": ["off"],
      "no-new": ["off"],
      "no-useless-constructor": ["off"],
      "@angular-eslint/component-selector": ["error", { prefix: "pydt", style: "kebab-case", type: "element" }],
      "@angular-eslint/directive-selector": ["error", { prefix: "app", style: "camelCase", type: "attribute" }],
      "no-shadow": "off",
      "@typescript-eslint/no-shadow": ["error"],
      "prettier/prettier": ["error", { endOfLine: "auto" }],
      // New in angular-eslint 22. The Angular 22 migration pinned every component to
      // ChangeDetectionStrategy.Eager to keep today's behavior; moving to OnPush is its own project.
      "@angular-eslint/prefer-on-push-component-change-detection": ["off"],
    },
  },
  {
    files: ["**/*.html"],
    extends: [...angular.configs.templateRecommended],
    rules: {},
  },
  {
    files: ["**/*.html"],
    ignores: ["**/*inline-template-*.component.html"],
    extends: [prettierRecommended],
    rules: {
      "prettier/prettier": ["error", { parser: "angular", endOfLine: "auto" }],
    },
  },
);
