import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// Endpoint to securely provide the Maps API key to the frontend
router.get("/maps/config", requireAuth, (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "Google Maps API key not configured on server." });
  }
  return res.json({ apiKey });
});

// Proxy for geocoding — uses OpenCage to avoid exposing the key in the frontend
router.get("/maps/geocode", requireAuth, async (req, res) => {
  try {
    const { address, lat, lng } = req.query;
    const apiKey = process.env.OPENCAGE_API_KEY;

    if (!apiKey) {
      return res.status(503).json({ error: "OpenCage API key not configured on server." });
    }

    let query: string;
    if (address && typeof address === "string") {
      query = encodeURIComponent(address);
    } else if (lat && lng) {
      query = `${lat}+${lng}`;
    } else {
      return res.status(400).json({ error: "Either address or lat/lng is required." });
    }

    const url = `https://api.opencagedata.com/geocode/v1/json?q=${query}&key=${apiKey}&limit=5&no_annotations=1&language=id`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.json(data);
  } catch (error) {
    console.error("Geocode proxy error:", error);
    return res.status(500).json({ error: "Internal server error during geocoding." });
  }
});

export default router;
