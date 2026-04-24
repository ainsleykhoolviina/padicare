import { Router } from "express";
import { db, collections } from "../lib/firebase";
import bcrypt from "bcryptjs";
import type { Request } from "express";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

const router = Router();

router.post("/auth/register", async (req: Request, res) => {
  const { name, email, password, phone, preferredLanguage } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password required" });
  }
  // Basic input validation
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }
  if (typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  if (typeof name !== "string" || name.trim().length < 2) {
    return res.status(400).json({ error: "Name must be at least 2 characters" });
  }
  try {
    // Check if user exists
    const usersRef = db.collection(collections.users);
    const existing = await usersRef.where("email", "==", email).limit(1).get();
    if (!existing.empty) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userData = {
      name,
      email,
      passwordHash,
      phone: phone || null,
      preferredLanguage: preferredLanguage || "ms",
      createdAt: new Date().toISOString(),
    };

    const userDoc = await usersRef.add(userData);
    req.session.userId = userDoc.id;

    return res.status(201).json({
      user: {
        id: userDoc.id,
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        preferredLanguage: userData.preferredLanguage,
        createdAt: userData.createdAt,
      },
      message: "Registration successful",
    });
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/login", async (req: Request, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Invalid input" });
  }
  try {
    const usersRef = db.collection(collections.users);
    const snapshot = await usersRef.where("email", "==", email).limit(1).get();
    
    if (snapshot.empty) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const userDoc = snapshot.docs[0];
    const user = userDoc.data();
    
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    req.session.userId = userDoc.id;
    return res.json({
      user: {
        id: userDoc.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        preferredLanguage: user.preferredLanguage,
        createdAt: user.createdAt,
      },
      message: "Login successful",
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", (req: Request, res) => {
  req.session.destroy(() => {});
  return res.json({ message: "Logged out" });
});

router.get("/auth/me", async (req: Request, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const userDoc = await db.collection(collections.users).doc(req.session.userId).get();
    
    if (!userDoc.exists) {
      return res.status(401).json({ error: "User not found" });
    }

    const user = userDoc.data();
    return res.json({
      id: userDoc.id,
      name: user?.name,
      email: user?.email,
      phone: user?.phone,
      preferredLanguage: user?.preferredLanguage,
      createdAt: user?.createdAt,
    });
  } catch (err) {
    console.error("Get user error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
