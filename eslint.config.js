import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import security from "eslint-plugin-security";
import noSecrets from "eslint-plugin-no-secrets";

export default tseslint.config(
  { 
    ignores: [
      // Dependencies
      "node_modules/",
      "server/node_modules/",
      "server/",
      
      // Build outputs
      "dist/",
      "build/",
      
      // Test files (scanned separately)
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.test.js",
      "cypress/",
      "cypress.config.ts",
      
      // Configuration files
      "*.config.js",
      "*.config.ts",
      "vite.config.ts",
      "vitest.config.ts",
      "tailwind.config.ts",
      "postcss.config.js",
      
      // Generated files
      "coverage/",
      ".vite/",
      
      // Logs and reports
      "logs/",
      "security-reports/",
      
      // Templates (code generation templates)
      "templates/",
      
      // Git
      ".git/",
    ] 
  },
  {
    // Configuração base para arquivos TypeScript com type-checking
    extends: [
      js.configs.recommended, 
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked
    ],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        project: ["./tsconfig.app.json", "./tsconfig.node.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "security": security,
      "no-secrets": noSecrets,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // TypeScript Rules - Balanced approach
      "@typescript-eslint/no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],
      "@typescript-eslint/no-explicit-any": "off", // Too many legacy uses
      "@typescript-eslint/no-floating-promises": "warn", // Downgrade to warn
      "@typescript-eslint/no-misused-promises": "warn", // Downgrade to warn
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off", // Stylistic, too noisy
      "@typescript-eslint/prefer-optional-chain": "off", // Stylistic, too noisy
      "@typescript-eslint/strict-boolean-expressions": "off",
      "@typescript-eslint/require-await": "off", // Too many false positives
      "@typescript-eslint/no-redundant-type-constituents": "off", // Stylistic
      "@typescript-eslint/no-empty-function": "off", // Common pattern
      "@typescript-eslint/prefer-promise-reject-errors": "off", // Too strict
      "@typescript-eslint/no-non-null-asserted-optional-chain": "warn", // Downgrade
      "@typescript-eslint/no-base-to-string": "off", // Too strict
      "@typescript-eslint/prefer-for-of": "off", // Stylistic
      "@typescript-eslint/restrict-template-expressions": "off", // Too strict
      "@typescript-eslint/no-empty-object-type": "off", // Common pattern
      // Disable unsafe rules that are too strict for existing codebase
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-enum-comparison": "off",
      // Standard JS rules
      "no-case-declarations": "off", // Common pattern in reducers
      "no-useless-escape": "warn", // Downgrade to warn
      "no-useless-catch": "warn", // Downgrade to warn
      "no-empty": "warn", // Downgrade to warn
      // Security rules
      "security/detect-object-injection": "warn",
      "security/detect-non-literal-regexp": "warn",
      "security/detect-unsafe-regex": "warn", // Downgrade to warn
      "security/detect-buffer-noassert": "error",
      "security/detect-child-process": "warn",
      "security/detect-disable-mustache-escape": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-no-csrf-before-method-override": "error",
      "security/detect-non-literal-fs-filename": "warn",
      "security/detect-non-literal-require": "warn",
      "security/detect-possible-timing-attacks": "warn",
      "security/detect-pseudoRandomBytes": "error",
      // No secrets rules
      "no-secrets/no-secrets": ["warn", { "tolerance": 4.5 }], // Downgrade to warn
    },
  }
);
