// Enhanced Mocha configuration for optimal testing
module.exports = {
  timeout: 60000, // Increased timeout for complex operations
  exit: true,
  recursive: true,
  reporter: "spec",
  bail: false, // Continue testing even if some tests fail
  slow: 2000, // Mark tests as slow if they take longer than 2s
  parallel: false, // Disable parallel to avoid rate limiting conflicts
  require: ["test/setup.js"],
  spec: ["test/**/*.test.js"],
  ignore: [
    "test/performance/**/*.js", // Run performance tests separately
    "coverage/**",
    "node_modules/**",
  ],
  "node-option": [
    "experimental-specifier-resolution=node",
    "no-warnings",
    "max-old-space-size=4096", // Increase memory for coverage tests
  ],
  // Global test environment
  globals: {
    NODE_ENV: "test",
    RATE_LIMIT_ENABLED: "false",
    TEST_MODE: "true",
  },
};
