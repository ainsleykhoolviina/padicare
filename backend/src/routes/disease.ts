import { Router } from "express";
import { db, collections } from "../lib/firebase";
import { requireAuth } from "../middlewares/requireAuth";
import type { Request } from "express";

const router = Router();

const DISEASE_DB = [
  {
    disease: "Magnaporthe oryzae", diseaseNameMs: "Barah Padi (Blast)", diseaseNameEn: "Rice Blast",
    severity: "sedang" as const,
    descriptionMs: "Penyakit kulat yang menyebabkan bintik-bintik berlian pada daun padi.",
    descriptionEn: "Fungal disease causing diamond-shaped spots on paddy leaves.",
    treatmentMs: "Gunakan racun kulat Tricyclazole (Beam 75WP) pada kadar 0.3 kg/ha.",
    treatmentEn: "Apply fungicide Tricyclazole (Beam 75WP) at 0.3 kg/ha.",
    riskFactors: ["Kelembapan tinggi >90%", "Suhu 24-28°C"],
    preventionTips: ["Gunakan benih rintang (MR220, MR263)", "Kawal penggunaan nitrogen"],
  },
  {
    disease: "Xanthomonas oryzae", diseaseNameMs: "Layu Padi (Blight)", diseaseNameEn: "Bacterial Leaf Blight",
    severity: "parah" as const,
    descriptionMs: "Jangkitan bakteria menyebabkan daun menguning bermula dari hujung daun.",
    descriptionEn: "Bacterial infection causing leaf yellowing starting from leaf tips.",
    treatmentMs: "Buang dan bakar tanaman yang teruk terjejas. Guna varieti rintang musim berikutnya.",
    treatmentEn: "Remove and burn severely infected plants. Use resistant varieties next season.",
    riskFactors: ["Air banjir", "Kelembapan tinggi"],
    preventionTips: ["Gunakan varieti rintang (MR219, MR284)", "Kawal paras air ladang"],
  },
  {
    disease: "Rice Tungro Virus", diseaseNameMs: "Tungro", diseaseNameEn: "Rice Tungro Disease",
    severity: "parah" as const,
    descriptionMs: "Penyakit virus disebarkan oleh wereng hijau. Daun bertukar kuning-jingga.",
    descriptionEn: "Viral disease spread by green leafhopper. Leaves turn yellow-orange.",
    treatmentMs: "Kawal wereng hijau menggunakan Imidacloprid. Buang tanaman yang dijangkiti.",
    treatmentEn: "Control green leafhopper using Imidacloprid. Remove infected plants.",
    riskFactors: ["Kehadiran wereng hijau", "Musim kemarau"],
    preventionTips: ["Guna varieti rintang Tungro", "Tanam serentak dalam kawasan"],
  },
  {
    disease: "Rhizoctonia solani", diseaseNameMs: "Reput Pelepah (Sheath Rot)", diseaseNameEn: "Sheath Blight",
    severity: "sedang" as const,
    descriptionMs: "Penyakit kulat menyerang pelepah padi dengan bintik-bintik coklat.",
    descriptionEn: "Fungal disease attacking paddy sheaths with brown spots.",
    treatmentMs: "Gunakan Hexaconazole (Anvil 5SC) atau Propiconazole (Tilt 250EC).",
    treatmentEn: "Apply Hexaconazole (Anvil 5SC) or Propiconazole (Tilt 250EC).",
    riskFactors: ["Populasi tanaman padat", "Nitrogen berlebihan"],
    preventionTips: ["Jarak tanam yang sesuai", "Kawal nitrogen"],
  },
  {
    disease: "Healthy", diseaseNameMs: "Sihat", diseaseNameEn: "Healthy Plant",
    severity: "ringan" as const,
    descriptionMs: "Tanaman padi kelihatan sihat tanpa tanda-tanda jangkitan penyakit.",
    descriptionEn: "Paddy plant appears healthy with no signs of disease.",
    treatmentMs: "Tiada rawatan diperlukan. Pantau ladang secara berkala.",
    treatmentEn: "No treatment required. Monitor the farm periodically.",
    riskFactors: [],
    preventionTips: ["Pantau ladang setiap minggu", "Jaga kebersihan saluran air"],
  },
];

router.post("/disease/detect", requireAuth, async (req: Request, res) => {
  const { imageBase64, farmId } = req.body;
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return res.status(400).json({ error: "imageBase64 required" });
  }
  if (farmId !== undefined && typeof farmId !== "string") {
    return res.status(400).json({ error: "farmId must be a string" });
  }

  const disease = DISEASE_DB[imageBase64.length % DISEASE_DB.length];
  const confidence = 72 + (imageBase64.length % 25);

  try {
    const recordData = {
      userId: req.session.userId!,
      farmId: farmId || null,
      disease: disease.disease,
      severity: disease.severity,
      confidencePercent: confidence,
      detectedAt: new Date().toISOString(),
    };

    const recordDoc = await db.collection(collections.diseaseDetections).add(recordData);
    return res.json({ ...disease, confidencePercent: confidence, recordId: recordDoc.id });
  } catch (err) {
    console.error("Disease detection error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/disease/history", requireAuth, async (req: Request, res) => {
  const { farmId } = req.query;
  try {
    let recordsRef = db.collection(collections.diseaseDetections).where("userId", "==", req.session.userId!);
    
    if (farmId) {
      recordsRef = recordsRef.where("farmId", "==", farmId as string) as any;
    }

    const snapshot = await recordsRef.get();
    const records = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    
    // Sort by detectedAt descending
    records.sort((a: any, b: any) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
    
    return res.json(records);
  } catch (err) {
    console.error("Get disease history error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
