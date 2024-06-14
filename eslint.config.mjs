import globals from "globals";
import pluginJs from "@eslint/js";

export default [
  {
    rules: {
      "no-unused-vars": "error",
      "prefer-const": "error",
      "no-undef": "error",
    },
  },
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  pluginJs.configs.recommended,
];
