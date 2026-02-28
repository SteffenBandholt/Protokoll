module.exports = {
  env: {
    node: true,
    browser: true,
    es2021: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "script",
  },
  globals: {
    __dirname: "readonly",
    __filename: "readonly",
    process: "readonly",
    Buffer: "readonly",
  },
  rules: {
    "no-undef": "error",
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    eqeqeq: ["error", "always"],
    "no-unreachable": "error",
    "no-var": "error",
    "prefer-const": "warn",
    "no-console": "off",
    "no-empty": "warn",
  },
};
