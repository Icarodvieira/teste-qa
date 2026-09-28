module.exports = {
  globalSetup: './helpers/iniciar-servidores.js',
  globalTeardown: './helpers/parar-servidores.js',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testTimeout: 15000,
};
