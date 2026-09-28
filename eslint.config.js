import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "_site/", "test-results/", "playwright-report/"] },
  js.configs.recommended,
  {
    files: ["web/js/**/*.js", "admin/**/*.js"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["tools/**/*.mjs", "test/**/*.mjs", "*.js", "*.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["web/lib/**/*.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
];
