module.exports = {
  extends: 'airbnb-base',
  env: {
    browser: true,
    es2021: true,
    jest: true,
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  rules: {
    'no-console': ['error', { allow: ['warn', 'error', 'log'] }],
    'max-len': ['error', { code: 100 }],
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'class-methods-use-this': 'off',
    'no-plusplus': 'off',
    'no-use-before-define': ['error', { functions: false }],
  },
};