import js from "@eslint/js"
import globals from "globals"
import prettier from "eslint-plugin-prettier/recommended"
import tseslint from "typescript-eslint"
import solid from "eslint-plugin-solid/configs/recommended"

delete globals.browser["AudioWorkletGlobalScope "]

export default [
  js.configs.recommended,
  ...tseslint.configs["recommended"],
  prettier,
  solid,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      sourceType: "module",
      ecmaVersion: "latest",
      parserOptions: {
        parser: tseslint.parser
      }
    }
  },
  {
    rules: {
      semi: ["warn", "never"],
      "dot-location": ["warn", "property"],
      "guard-for-in": ["off"],
      "no-multi-spaces": ["warn"],
      "comma-style": ["warn"],
      "block-spacing": ["warn"],
      "keyword-spacing": ["warn"],
      "no-trailing-spaces": ["warn"],
      "no-unneeded-ternary": ["warn"],
      "no-whitespace-before-property": ["warn"],
      "space-before-blocks": ["warn"],
      "space-in-parens": ["warn"],
      "arrow-spacing": ["warn"],
      "no-duplicate-imports": ["error"],
      "no-var": ["error"],
      "prefer-const": ["off"],
      "no-unused-vars": ["off"],
      "@typescript-eslint/no-unused-vars": ["off"],
      "@typescript-eslint/no-explicit-any": ["off"],
      "no-case-declarations": ["off"],
      "prettier/prettier": ["warn"],
      "no-async-promise-executor": ["off"]
    }
  }
]
