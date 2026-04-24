// Must be first — load env before any other imports
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import app from "./app";
import { logger } from "./lib/logger";

const port = Number(process.env.PORT) || 8080;

app.listen(port, (err?: Error) => {
  if (err) { logger.error({ err }, "Error starting server"); process.exit(1); }
  logger.info({ port }, "Server listening");
});
