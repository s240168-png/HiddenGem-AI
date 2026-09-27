const path = require("path");
const { spawn } = require("child_process");

const workerPath = path.join(__dirname, "..", "..", "python-service", "recommendation.py");
let worker = null;

function startWorker() {
  // Never spawn Python process in production or if explicitly disabled
  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test" || process.env.DISABLE_PYTHON_SPAWN === "true") {
    return null;
  }

  if (worker && !worker.killed) return worker;

  const command = process.env.PYTHON_EXECUTABLE || (process.platform === "win32" ? "py" : "python3");
  const args = process.platform === "win32" && !process.env.PYTHON_EXECUTABLE
    ? ["-3", workerPath]
    : [workerPath];

  try {
    worker = spawn(command, args, {
      stdio: "inherit",
      env: { ...process.env, TOKENIZERS_PARALLELISM: "false" }
    });

    worker.on("error", error => {
      worker = null;
      console.error(`Python dev worker could not start: ${error.message}`);
    });
    
    worker.on("exit", code => {
      worker = null;
      if (code !== 0 && code !== null) {
        console.error(`Python dev worker exited with code ${code}`);
      }
    });
    return worker;
  } catch (err) {
    console.error("Failed to spawn dev Python worker:", err.message);
    return null;
  }
}

// Proactively start dev worker only if in dev environment
if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test" && process.env.DISABLE_PYTHON_SPAWN !== "true") {
  startWorker();
}

async function generateItinerary(payload) {
  // If in dev mode and worker died, attempt start
  if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test" && process.env.DISABLE_PYTHON_SPAWN !== "true") {
    if (!worker || worker.killed) startWorker();
  }

  const baseUrl = (process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
  const timeoutMs = Number(process.env.PYTHON_SERVICE_TIMEOUT_MS) || 8000;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${baseUrl}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.message || `Python ML service returned HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.itinerary)) {
      throw new Error("Invalid response format from Python ML service");
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`Python ML service request timed out after ${timeoutMs}ms.`);
      throw new Error("The semantic recommendation model took too long to respond or timed out.");
    }
    console.error("semanticRecommendationService error:", error.message);
    throw new Error(`The semantic recommendation service is currently unavailable: ${error.message}`);
  }
}

module.exports = { generateItinerary, startWorker };
