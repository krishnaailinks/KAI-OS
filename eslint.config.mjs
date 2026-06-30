import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/sw.js",
    "public/workbox-*.js",
    "scripts/**",
    "fix_rbac.js",
    "tsconfig.tsbuildinfo",
  ]),
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      // Allow intentionally-unused identifiers prefixed with `_`
      // (e.g. required-but-unused signature params like `_config`).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Test files use require() for dynamic imports (Jest pattern) and often
  // carry scaffolding identifiers that are intentionally unused.
  {
    files: ["src/__tests__/**/*.test.ts", "tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
]);

export default eslintConfig;
