// ESLint mínimo: pega variável não declarada e sobra de código no servidor.
// public/ fica de fora: os scripts do front compartilham globais entre arquivos <script>.
const globals = require("globals");

module.exports = [
  {
    files: ["server.js", "knexfile.js", "config/**/*.js", "middleware/**/*.js", "routes/**/*.js", "services/**/*.js", "validations/**/*.js", "migrations/**/*.js", "scripts/**/*.js", "tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "commonjs",
      globals: globals.node,
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none", ignoreRestSiblings: true }],
    },
  },
];
