module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  plugins: ["@typescript-eslint", "react-hooks"],
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  ignorePatterns: ["dist/", "node_modules/", "resources/bible/raw/", "*.cjs"],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/no-explicit-any": "warn",
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
  overrides: [
    {
      files: ["scripts/**/*.ts", "scripts/**/*.mjs"],
      rules: { "no-console": "off" },
    },
  ],
};
