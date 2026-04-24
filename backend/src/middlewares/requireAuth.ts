import type { Request, Response, NextFunction } from "express";
import { auth } from "../lib/firebase";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // 1. Check existing session (from /api/auth/login)
  if (req.session?.userId) {
    return next();
  }

  // 2. Check Firebase ID token from Authorization header
  //    Frontend uses Firebase Auth client SDK, so it sends the token here
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const decoded = await auth.verifyIdToken(token);
      // Set session so subsequent requests in the same session don't need to verify again
      req.session.userId = decoded.uid;
      return next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  }

  return res.status(401).json({ error: "Authentication required" });
}
