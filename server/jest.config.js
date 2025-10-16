// jest.config.js
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__"],
  collectCoverage: true,
  collectCoverageFrom: [
  "controllers/**/*.js",
  "routes/**/*.js",
  "validators/**/*.js",
  "models/**/*.js",
  "Utils/**/*.js",
  "!server.js",
  "!app.js",
  "!db.js"
],
  coverageThreshold: {
    global: { branches: 60, functions: 60, lines: 60, statements: 60 }
  },
  setupFiles: ["<rootDir>/jest.setup.js"], // Asegúrate de que la ruta esté correcta
  testMatch: ["**/__tests__/**/*.(test|spec).js"]
};
