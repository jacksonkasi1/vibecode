import globals from "globals";
import config from "@repo/eslint-config";

export default [
  ...config,
  {
    files: ["*.{js,mjs,cjs,ts}", "*.config.{js,mjs,cjs,ts}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["src/**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
];
