import path from "path";
import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger";

// Resolve credentials path to absolute so the SDK always finds it
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (credentialsPath && !path.isAbsolute(credentialsPath)) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(process.cwd(), credentialsPath);
}

const project = process.env.GOOGLE_CLOUD_PROJECT_ID;
const location = process.env.GOOGLE_CLOUD_LOCATION || "global";

if (!project) {
  logger.error("GOOGLE_CLOUD_PROJECT_ID is missing in .env");
  throw new Error("GOOGLE_CLOUD_PROJECT_ID is required in .env file");
}

if (!credentialsPath) {
  logger.warn("GOOGLE_APPLICATION_CREDENTIALS is not set. Vertex AI might fail if not running in GCP.");
}

export const vertexClient = new GoogleGenAI({
  vertexai: true,
  project,
  location,
});

export const vertexModel = process.env.GOOGLE_CLOUD_MODEL || "gemini-2.5-flash";

// Fine-tuned paddy disease model endpoint (from Vertex AI Studio tuning)
// Called via the same Vertex AI client — no separate API key needed
export const tunedDiseaseModel = process.env.GOOGLE_CLOUD_TUNED_MODEL || null;

logger.info({
  project,
  location,
  model: vertexModel,
  tunedDiseaseModel: tunedDiseaseModel ?? "not configured (will fall back to base model)",
  credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
}, "Vertex AI client initialized");
