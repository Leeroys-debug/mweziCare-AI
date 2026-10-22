import jsxA11y from "eslint-plugin-jsx-a11y";
import base from "./base.js";

export default [
  ...base,
  jsxA11y.flatConfigs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
];
