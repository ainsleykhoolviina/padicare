import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import admin from "firebase-admin";
import { logger } from "./logger";

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    
    if (!projectId) {
      throw new Error("FIREBASE_PROJECT_ID is required in .env file");
    }

    // Initialize with project ID only (works for local development with Firestore)
    admin.initializeApp({
      projectId,
    });

    logger.info({ projectId }, "Firebase Admin initialized successfully");
  } catch (error) {
    logger.error({ error }, "Failed to initialize Firebase Admin");
    throw error;
  }
}

export const db = admin.firestore();
export const auth = admin.auth();

// Firestore collection names
export const collections = {
  users: "users",
  farms: "farms",
  farmIssues: "farmIssues",
  tasks: "tasks",
  diseaseDetections: "diseaseDetections",
  notifications: "notifications",
};
