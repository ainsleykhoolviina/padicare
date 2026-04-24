import { Router } from "express";
import { db, collections } from "../lib/firebase";
import { requireAuth } from "../middlewares/requireAuth";
import type { Request } from "express";

const router = Router();

router.get("/tasks", requireAuth, async (req: Request, res) => {
  const { farmId, status } = req.query;
  try {
    let tasksRef = db.collection(collections.tasks).where("userId", "==", req.session.userId!);
    
    if (farmId) {
      tasksRef = tasksRef.where("farmId", "==", farmId as string) as any;
    }
    if (status) {
      tasksRef = tasksRef.where("status", "==", status as string) as any;
    }

    const snapshot = await tasksRef.get();
    const tasks = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    
    return res.json(tasks);
  } catch (err) {
    console.error("Get tasks error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tasks", requireAuth, async (req: Request, res) => {
  const { farmId, title, description, dueDate, priority } = req.body;
  if (!farmId || !title) {
    return res.status(400).json({ error: "farmId and title required" });
  }
  if (typeof title !== "string" || title.trim().length === 0) {
    return res.status(400).json({ error: "title must be a non-empty string" });
  }
  // Validate dueDate if provided
  if (dueDate !== undefined && dueDate !== null) {
    const parsed = new Date(dueDate);
    if (isNaN(parsed.getTime())) {
      return res.status(400).json({ error: "dueDate must be a valid date string" });
    }
  }
  const validPriorities = ["low", "medium", "high"];
  if (priority !== undefined && !validPriorities.includes(priority)) {
    return res.status(400).json({ error: "priority must be low, medium, or high" });
  }
  try {
    const taskData = {
      farmId,
      userId: req.session.userId!,
      title,
      description: description || null,
      status: "pending",
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      priority: priority || "medium",
      createdAt: new Date().toISOString(),
    };

    const taskDoc = await db.collection(collections.tasks).add(taskData);
    return res.status(201).json({ id: taskDoc.id, ...taskData });
  } catch (err) {
    console.error("Create task error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/tasks/:taskId", requireAuth, async (req: Request, res) => {
  const taskId = req.params.taskId;
  const { title, description, status, dueDate, priority } = req.body;
  try {
    const taskRef = db.collection(collections.tasks).doc(taskId);
    const taskDoc = await taskRef.get();
    
    if (!taskDoc.exists || taskDoc.data()?.userId !== req.session.userId) {
      return res.status(404).json({ error: "Task not found" });
    }

    const existing = taskDoc.data();
    const updateData = {
      title: title ?? existing?.title,
      description: description ?? existing?.description,
      status: status ?? existing?.status,
      dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate).toISOString() : null) : existing?.dueDate,
      priority: priority ?? existing?.priority,
    };

    await taskRef.update(updateData);
    return res.json({ id: taskId, ...existing, ...updateData });
  } catch (err) {
    console.error("Update task error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/tasks/:taskId", requireAuth, async (req: Request, res) => {
  const taskId = req.params.taskId;
  try {
    const taskRef = db.collection(collections.tasks).doc(taskId);
    const taskDoc = await taskRef.get();
    
    if (!taskDoc.exists || taskDoc.data()?.userId !== req.session.userId) {
      return res.status(404).json({ error: "Task not found" });
    }

    await taskRef.delete();
    return res.json({ message: "Task deleted" });
  } catch (err) {
    console.error("Delete task error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
