require("dotenv").config();

const { startExtractionWorker } = require("../services/extractionQueue");

try {
  startExtractionWorker();
  console.log("PDF extraction worker started.");
} catch (error) {
  console.error("Failed to start extraction worker:", error.message);
  process.exit(1);
}

