import { Router } from "express";
import { db, collections } from "../lib/firebase";
import { requireAuth } from "../middlewares/requireAuth";
import type { Request } from "express";

const router = Router();

const PHASE_ORDER = ["nursery", "vegetative", "reproductive", "ripening", "harvested"];

router.get("/dashboard/summary", requireAuth, async (req: Request, res) => {
  const userId = req.session.userId!;
  try {
    const [farmsSnapshot, tasksSnapshot, detectionsSnapshot, notificationsSnapshot] = await Promise.all([
      db.collection(collections.farms).where("userId", "==", userId).get(),
      db.collection(collections.tasks).where("userId", "==", userId).get(),
      db.collection(collections.diseaseDetections).where("userId", "==", userId).get(),
      db.collection(collections.notifications).where("userId", "==", userId).where("isRead", "==", false).get(),
    ]);

    const farms = farmsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const tasks = tasksSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const detections = detectionsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const notifications = notificationsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    const now = new Date();
    const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return res.json({
      summary: {
        totalFarms: farms.length,
        totalHectares: farms.reduce((s: number, f: any) => s + (f.farmSizeHectares || 0), 0),
        totalTasks: tasks.length,
        pendingTasks: tasks.filter((t: any) => t.status === "pending").length,
        inProgressTasks: tasks.filter((t: any) => t.status === "in_progress").length,
        doneTasks: tasks.filter((t: any) => t.status === "done").length,
        unreadNotifications: notifications.length,
        totalDetections: detections.length,
      },
      farms: farms.map((f: any) => ({
        id: f.id,
        name: f.name,
        location: f.location,
        paddyType: f.paddyType,
        growthPhase: f.growthPhase,
        farmSizeHectares: f.farmSizeHectares,
        paddyAgeWeeks: f.paddyAgeWeeks,
        growthProgress: Math.round(((PHASE_ORDER.indexOf(f.growthPhase) + 1) / PHASE_ORDER.length) * 100),
      })),
      recentDetections: detections
        .sort((a: any, b: any) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
        .slice(0, 5)
        .map((d: any) => ({
          id: d.id,
          disease: d.disease,
          severity: d.severity,
          confidencePercent: d.confidencePercent,
          detectedAt: d.detectedAt,
        })),
      upcomingTasks: tasks
        .filter((t: any) => t.status !== "done" && t.dueDate && new Date(t.dueDate) <= week)
        .sort((a: any, b: any) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
        .slice(0, 5),
    });
  } catch (err) {
    console.error("Dashboard summary error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
