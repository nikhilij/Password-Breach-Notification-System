const path = require("path");
const { spawn } = require("child_process");

// Configuration
const testFolders = ["unit", "integration", "e2e", "api"];

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

/**
 * Run tests in the specified folder
 * @param {string} folder - Test folder name
 * @returns {Promise<boolean>} - True if tests pass, false otherwise
 */
function runTests(folder) {
  return new Promise((resolve) => {
    console.log(
      `\n${colors.bright}${colors.cyan}Running ${folder} tests...${colors.reset}\n`,
    );

    const testPath = path.join("test", folder);

    const mochaProcess = spawn(
      "npx",
      ["mocha", `${testPath}/**/*.test.js`, "--colors"],
      {
        stdio: "inherit",
        shell: true,
      },
    );

    mochaProcess.on("close", (code) => {
      const passed = code === 0;
      if (passed) {
        console.log(
          `\n${colors.green}✓ ${folder} tests passed${colors.reset}\n`,
        );
      } else {
        console.log(`\n${colors.red}✗ ${folder} tests failed${colors.reset}\n`);
      }
      resolve(passed);
    });
  });
}

/**
 * Run all test suites sequentially
 */
async function runAllTests() {
  console.log(
    `${colors.bright}${colors.blue}Starting test run...${colors.reset}\n`,
  );

  const results = {};
  let allPassed = true;

  for (const folder of testFolders) {
    const passed = await runTests(folder);
    results[folder] = passed;
    if (!passed) allPassed = false;
  }

  // Print summary
  console.log(`${colors.bright}${colors.magenta}Test Summary:${colors.reset}`);
  for (const [folder, passed] of Object.entries(results)) {
    const status = passed
      ? `${colors.green}PASS${colors.reset}`
      : `${colors.red}FAIL${colors.reset}`;
    console.log(`${folder}: ${status}`);
  }

  const finalStatus = allPassed
    ? `${colors.bright}${colors.green}ALL TESTS PASSED${colors.reset}`
    : `${colors.bright}${colors.red}SOME TESTS FAILED${colors.reset}`;

  console.log(`\n${finalStatus}`);
  process.exit(allPassed ? 0 : 1);
}

// Start the test run
runAllTests().catch((error) => {
  console.error(`${colors.red}Error running tests:${colors.reset}`, error);
  process.exit(1);
});
