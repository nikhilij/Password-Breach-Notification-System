/**
 * Generate a consolidated test coverage report
 */
const fs = require("fs");
const path = require("path");

// Configuration
const coverageDirs = [
  "reports/unit/coverage",
  "reports/integration/coverage",
  "reports/api/coverage",
];

const outputDir = "reports/consolidated";

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Combine coverage data
console.log("Generating consolidated coverage report...");

// TODO: Implement coverage consolidation logic
// This would involve merging the different coverage.json files
// For now, we'll just copy the most complete coverage report

let mostCompleteReport = null;
let maxCoveredFiles = 0;

coverageDirs.forEach((dir) => {
  if (fs.existsSync(dir)) {
    try {
      const coverageFile = path.join(dir, "coverage-final.json");
      if (fs.existsSync(coverageFile)) {
        const coverage = JSON.parse(fs.readFileSync(coverageFile, "utf8"));
        const coveredFiles = Object.keys(coverage).length;

        if (coveredFiles > maxCoveredFiles) {
          mostCompleteReport = coverageFile;
          maxCoveredFiles = coveredFiles;
        }

        console.log(`Found coverage for ${coveredFiles} files in ${dir}`);
      }
    } catch (error) {
      console.error(`Error processing coverage from ${dir}:`, error);
    }
  }
});

if (mostCompleteReport) {
  console.log(`Using most complete coverage report from ${mostCompleteReport}`);
  fs.copyFileSync(
    mostCompleteReport,
    path.join(outputDir, "coverage-final.json"),
  );

  console.log(`Consolidated report saved to ${outputDir}`);
} else {
  console.error("No coverage reports found");
}
