import { Router } from "express";
import authRouter from "./auth";
import farmsRouter from "./farms";
import tasksRouter from "./tasks";
import diseaseRouter from "./disease";
import weatherRouter from "./weather";
import dashboardRouter from "./dashboard";
import aiRouter from "./ai";
import mapsRouter from "./maps";

const router = Router();

router.get("/health", (_, res) => res.json({ status: "ok" }));
router.use(authRouter);
router.use(farmsRouter);
router.use(tasksRouter);
router.use(diseaseRouter);
router.use(weatherRouter);
router.use(dashboardRouter);
router.use(aiRouter);
router.use(mapsRouter);

export default router;
