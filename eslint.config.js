import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "_site/"] },
  js.configs.recommended,
  {
    files: ["js/**/*.js"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["scripts/**/*.mjs", "test/**/*.mjs", "*.js"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["scripts/lib/**/*.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
];
