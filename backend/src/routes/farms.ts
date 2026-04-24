import { Router } from "express";
import { db, collections } from "../lib/firebase";
import { requireAuth } from "../middlewares/requireAuth";
import type { Request } from "express";

const router = Router();

router.get("/farms", requireAuth, async (req: Request, res) => {
  try {
    const farmsRef = db.collection(collections.farms);
    const snapshot = await farmsRef.where("userId", "==", req.session.userId!).get();
    
    const farms = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const issuesSnapshot = await db
          .collection(collections.farmIssues)
          .where("farmId", "==", doc.id)
          .get();
        
        const issues = issuesSnapshot.docs.map((issueDoc) => ({
          id: issueDoc.id,
          ...issueDoc.data(),
        }));

        return {
          id: doc.id,
          ...doc.data(),
          issues,
        };
      })
    );

    return res.json(farms);
  } catch (err) {
    console.error("Get farms error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/farms", requireAuth, async (req: Request, res) => {
  const { name, location, latitude, longitude, paddyType, farmSizeHectares, paddyAgeWeeks, growthPhase, notes } = req.body;
  if (!name || !location) {
    return res.status(400).json({ error: "Name and location required" });
  }
  try {
    const farmData = {
      userId: req.session.userId!,
      name,
      location,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      paddyType: paddyType || "MR219",
      farmSizeHectares: parseFloat(farmSizeHectares) || 1,
      paddyAgeWeeks: parseInt(paddyAgeWeeks) || 0,
      growthPhase: growthPhase || "nursery",
      notes: notes || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const farmDoc = await db.collection(collections.farms).add(farmData);
    return res.status(201).json({ id: farmDoc.id, ...farmData, issues: [] });
  } catch (err) {
    console.error("Create farm error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/farms/:farmId", requireAuth, async (req: Request, res) => {
  const farmId = req.params.farmId;
  try {
    const farmDoc = await db.collection(collections.farms).doc(farmId).get();
    
    if (!farmDoc.exists || farmDoc.data()?.userId !== req.session.userId) {
      return res.status(404).json({ error: "Farm not found" });
    }

    const issuesSnapshot = await db
      .collection(collections.farmIssues)
      .where("farmId", "==", farmId)
      .get();
    
    const issues = issuesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.json({ id: farmDoc.id, ...farmDoc.data(), issues });
  } catch (err) {
    console.error("Get farm error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/farms/:farmId", requireAuth, async (req: Request, res) => {
  const farmId = req.params.farmId;
  const { name, location, latitude, longitude, paddyType, farmSizeHectares, paddyAgeWeeks, growthPhase, notes } = req.body;
  try {
    const farmRef = db.collection(collections.farms).doc(farmId);
    const farmDoc = await farmRef.get();
    
    if (!farmDoc.exists || farmDoc.data()?.userId !== req.session.userId) {
      return res.status(404).json({ error: "Farm not found" });
    }

    const existing = farmDoc.data();
    const updateData = {
      name: name ?? existing?.name,
      location: location ?? existing?.location,
      latitude: latitude ?? existing?.latitude,
      longitude: longitude ?? existing?.longitude,
      paddyType: paddyType ?? existing?.paddyType,
      farmSizeHectares: farmSizeHectares ? parseFloat(farmSizeHectares) : existing?.farmSizeHectares,
      paddyAgeWeeks: paddyAgeWeeks !== undefined ? parseInt(paddyAgeWeeks) : existing?.paddyAgeWeeks,
      growthPhase: growthPhase ?? existing?.growthPhase,
      notes: notes ?? existing?.notes,
      updatedAt: new Date().toISOString(),
    };

    await farmRef.update(updateData);

    const issuesSnapshot = await db
      .collection(collections.farmIssues)
      .where("farmId", "==", farmId)
      .get();
    
    const issues = issuesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.json({ id: farmId, ...existing, ...updateData, issues });
  } catch (err) {
    console.error("Update farm error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/farms/:farmId", requireAuth, async (req: Request, res) => {
  const farmId = req.params.farmId;
  try {
    const farmRef = db.collection(collections.farms).doc(farmId);
    const farmDoc = await farmRef.get();
    
    if (!farmDoc.exists || farmDoc.data()?.userId !== req.session.userId) {
      return res.status(404).json({ error: "Farm not found" });
    }

    // Delete associated issues
    const issuesSnapshot = await db
      .collection(collections.farmIssues)
      .where("farmId", "==", farmId)
      .get();
    
    const batch = db.batch();
    issuesSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(farmRef);
    await batch.commit();

    return res.json({ message: "Farm deleted" });
  } catch (err) {
    console.error("Delete farm error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/farms/:farmId/issues", requireAuth, async (req: Request, res) => {
  const farmId = req.params.farmId;
  const { issueType, description, occurredAt } = req.body;
  try {
    const issueData = {
      farmId,
      issueType,
      description: description || null,
      occurredAt: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString(),
    };

    const issueDoc = await db.collection(collections.farmIssues).add(issueData);
    return res.status(201).json({ id: issueDoc.id, ...issueData });
  } catch (err) {
    console.error("Create issue error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
