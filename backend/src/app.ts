import path from "path";
import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import router from "./routes";
import { logger } from "./lib/logger";
import "./lib/vertexai"; // initialize Vertex AI client at startup

const app = express();

// Trust Cloud Run / GCP load balancer proxy — required for secure cookies over HTTPS
app.set("trust proxy", 1);

app.use(pinoHttp({ logger }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(session({
  secret: process.env.SESSION_SECRET || "padicare-secret-key-2024",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === "production", httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

app.use("/api", router);

// Serve static frontend assets from dist
const frontendPath = path.join(__dirname, "../../frontend/dist");
app.use(express.static(frontendPath));

// Fallback to index.html for SPA routing
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// Global error handler — prevents stack traces leaking to clients in production
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message });
});

export default app;