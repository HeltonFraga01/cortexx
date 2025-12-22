import js from "@eslint/js";
import globals from "globals";
import security from "eslint-plugin-security";
import noSecrets from "eslint-plugin-no-secrets";

export default [
  {
    ignores: [
      "node_modules/**",
      "migrations-sqlite-archived/**",
      "tests/**",
      "**/*.test.js",
      "**/*.property.test.js",
    ],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.es2021,
        // Jest/test globals
        jest: "readonly",
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
      },
    },
    plugins: {
      security,
      "no-secrets": noSecrets,
    },
    rules: {
      ...js.configs.recommended.rules,
      // Relaxed rules for existing codebase
      "no-unused-vars": ["error", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_|^error$|^e$"
      }],
      "no-empty": ["error", { "allowEmptyCatch": true }],
      // Security rules
      "security/detect-object-injection": "warn",
      "security/detect-non-literal-regexp": "warn",
      "security/detect-unsafe-regex": "error",
      "security/detect-buffer-noassert": "error",
      "security/detect-child-process": "warn",
      "security/detect-disable-mustache-escape": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-no-csrf-before-method-override": "error",
      "security/detect-non-literal-fs-filename": "warn",
      "security/detect-non-literal-require": "warn",
      "security/detect-possible-timing-attacks": "warn",
      "security/detect-pseudoRandomBytes": "error",
      // No secrets rules - increased tolerance for test data
      "no-secrets/no-secrets": ["error", { tolerance: 5.0 }],
    },
  },
];
