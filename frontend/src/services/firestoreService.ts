import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { requireFirebase } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import { generateMockWeather } from "@/lib/mockWeather";
import type { DiseasePrediction, Farm, FarmSizeCategory, GrowthPhase, Language, PaddyAgeRange, UserProfile, WeeklyTask, WeeklyTaskPlan } from "@/lib/models";

function clean<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

function toIso(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function userDoc(uid: string) {
  const { db } = requireFirebase();
  return doc(db, "users", uid);
}

export function isFirestoreSetupError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("database '(default)' not found") || message.includes("client is offline") || message.includes("cloud firestore has not been used");
}

export function isFirestorePermissionError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.message.toLowerCase().includes("missing or insufficient permissions");
}

export function firebaseErrorMessage(error: unknown, lang: Language, context: "login" | "register" | "save" = "save") {
  if (error instanceof Error && error.message.includes("Firebase is not configured")) {
    return lang === "ms"
      ? "Firebase belum dikonfigurasi. Tambah nilai VITE_FIREBASE_* dalam fail .env."
      : "Firebase is not configured. Add VITE_FIREBASE_* values to the .env file.";
  }
  if (isFirestoreSetupError(error)) {
    return lang === "ms"
      ? "Firestore belum dicipta untuk projek Firebase ini. Buka Firebase Console, pergi ke Firestore Database, dan klik Create database."
      : "Firestore has not been created for this Firebase project yet. Open Firebase Console, go to Firestore Database, and click Create database.";
  }
  if (isFirestorePermissionError(error)) {
    return lang === "ms"
      ? "Kebenaran Firestore disekat. Semak Rules dalam Firebase Console dan benarkan pengguna yang log masuk membaca/menulis data mereka sendiri."
      : "Firestore permissions are blocking this request. Check Rules in Firebase Console and allow signed-in users to read/write their own data.";
  }
  if (context === "login") {
    return lang === "ms" ? "E-mel atau kata laluan salah." : "Invalid email or password.";
  }
  if (context === "register") {
    return lang === "ms" ? "Pendaftaran gagal. E-mel mungkin sudah digunakan." : "Registration failed. Email may already be in use.";
  }
  return lang === "ms" ? "Tindakan gagal. Sila cuba lagi." : "Action failed. Please try again.";
}

function mapFarm(id: string, data: DocumentData): Farm {
  return {
    id,
    name: data.name ?? "",
    location: data.location ?? "",
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    environment: data.environment ?? "Humid tropical paddy field",
    paddyType: data.paddyType ?? "MR219",
    farmSizeCategory: data.farmSizeCategory ?? "small",
    paddyAgeRange: data.paddyAgeRange ?? "0-30",
    growthPhase: data.growthPhase ?? "nursery",
    notes: data.notes ?? null,
    mockWeather: data.mockWeather ?? generateMockWeather(data.latitude, data.longitude),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

function mapDetection(id: string, data: DocumentData): DiseasePrediction {
  return {
    id,
    farmId: data.farmId ?? null,
    disease: data.disease ?? "Unknown",
    diseaseNameMs: data.diseaseNameMs ?? data.disease ?? "Tidak diketahui",
    diseaseNameEn: data.diseaseNameEn ?? data.disease ?? "Unknown",
    severity: data.severity ?? "ringan",
    confidencePercent: data.confidencePercent ?? 0,
    recommendations: data.recommendations ?? [],
    descriptionMs: data.descriptionMs ?? "",
    descriptionEn: data.descriptionEn ?? "",
    treatmentMs: data.treatmentMs ?? "",
    treatmentEn: data.treatmentEn ?? "",
    modelUsed: data.modelUsed ?? "PadiCare Mock Vision",
    detectedAt: toIso(data.detectedAt),
  };
}

function mapPlan(id: string, data: DocumentData): WeeklyTaskPlan {
  return {
    id,
    farmId: data.farmId ?? null,
    farmName: data.farmName ?? "PadiCare",
    weekStart: data.weekStart ?? startOfWeek().toISOString(),
    source: data.source ?? "manual",
    tasks: data.tasks ?? [],
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

export async function registerWithFirebase(data: { name: string; email: string; password: string; phone?: string | null; preferredLanguage: Language }) {
  const { auth } = requireFirebase();
  const credential = await createUserWithEmailAndPassword(auth, data.email, data.password);
  await updateProfile(credential.user, { displayName: data.name });
  const profile: UserProfile = {
    id: credential.user.uid,
    name: data.name,
    email: data.email,
    phone: data.phone ?? null,
    preferredLanguage: data.preferredLanguage,
  };
  try {
    await setDoc(userDoc(credential.user.uid), clean({ ...profile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  } catch (error) {
    await signOut(auth).catch(() => {});
    throw error;
  }
  return profile;
}

export async function loginWithFirebase(email: string, password: string) {
  const { auth } = requireFirebase();
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function logoutFromFirebase() {
  const { auth } = requireFirebase();
  await signOut(auth);
}

export async function getUserProfile(uid: string, fallback: { name?: string | null; email?: string | null }): Promise<UserProfile> {
  const snap = await getDoc(userDoc(uid));
  if (snap.exists()) {
    const data = snap.data();
    return {
      id: uid,
      name: data.name ?? fallback.name ?? "PadiCare Farmer",
      email: data.email ?? fallback.email ?? "",
      phone: data.phone ?? null,
      preferredLanguage: data.preferredLanguage ?? "ms",
    };
  }
  const profile: UserProfile = {
    id: uid,
    name: fallback.name ?? "PadiCare Farmer",
    email: fallback.email ?? "",
    phone: null,
    preferredLanguage: "ms",
  };
  await setDoc(userDoc(uid), clean({ ...profile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  return profile;
}

export function useFarms(uid?: string) {
  const [data, setData] = useState<Farm[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(uid));
  useEffect(() => {
    if (!uid) {
      setData([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { db } = requireFirebase();
    const q = query(collection(db, "farms"), where("userId", "==", uid));
    return onSnapshot(q, (snap) => {
      console.log("Fetched farms snapshot size:", snap.docs.length);
      const farmsList = snap.docs.map((item) => mapFarm(item.id, item.data()));
      // Sort locally to avoid requiring a composite index in Firestore
      farmsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setData(farmsList);
      setIsLoading(false);
    }, (error) => {
      console.error("useFarms onSnapshot error:", error);
      setIsLoading(false);
    });
  }, [uid]);
  return { data, isLoading };
}

export function useFarm(uid?: string, farmId?: string) {
  const [data, setData] = useState<Farm | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(uid && farmId));
  useEffect(() => {
    if (!uid || !farmId) {
      setData(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { db } = requireFirebase();
    const ref = doc(db, "farms", farmId);
    return onSnapshot(ref, (snap) => {
      setData(snap.exists() ? mapFarm(snap.id, snap.data()) : null);
      setIsLoading(false);
    }, () => setIsLoading(false));
  }, [uid, farmId]);
  return { data, isLoading };
}

export async function saveFarm(uid: string, farm: Omit<Farm, "id" | "createdAt" | "updatedAt" | "mockWeather"> & { id?: string }) {
  const payload = clean({
    ...farm,
    userId: uid,
    mockWeather: generateMockWeather(farm.latitude, farm.longitude),
    updatedAt: serverTimestamp(),
  });
  const { db } = requireFirebase();
  if (farm.id) {
    await updateDoc(doc(db, "farms", farm.id), payload);
    return farm.id;
  }
  const ref = await addDoc(collection(db, "farms"), { ...payload, createdAt: serverTimestamp() });
  return ref.id;
}

export async function deleteFarm(uid: string, farmId: string) {
  const { db } = requireFirebase();
  await deleteDoc(doc(db, "farms", farmId));
}

export function useDiseaseDetections(uid?: string) {
  const [data, setData] = useState<DiseasePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(uid));
  useEffect(() => {
    if (!uid) {
      setData([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { db } = requireFirebase();
    const q = query(collection(db, "diseaseDetections"), where("userId", "==", uid));
    return onSnapshot(q, (snap) => {
      const items = snap.docs.map((item) => mapDetection(item.id, item.data()));
      items.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
      setData(items);
      setIsLoading(false);
    }, (error) => {
      console.error("useDiseaseDetections error:", error);
      setIsLoading(false);
    });
  }, [uid]);
  return { data, isLoading };
}

export async function saveDiseaseDetection(uid: string, detection: Omit<DiseasePrediction, "id" | "detectedAt">, farmId?: string | null) {
  const { db } = requireFirebase();
  const ref = await addDoc(collection(db, "diseaseDetections"), {
    ...detection,
    userId: uid,
    farmId: farmId ?? null,
    detectedAt: serverTimestamp(),
  });
  return ref.id;
}

export function useTaskPlans(uid?: string) {
  const [data, setData] = useState<WeeklyTaskPlan[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(uid));
  useEffect(() => {
    if (!uid) {
      setData([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { db } = requireFirebase();
    const q = query(collection(db, "weeklyTaskPlans"), where("userId", "==", uid));
    return onSnapshot(q, (snap) => {
      const items = snap.docs.map((item) => mapPlan(item.id, item.data()));
      items.sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime());
      setData(items);
      setIsLoading(false);
    }, (error) => {
      console.error("useTaskPlans error:", error);
      setIsLoading(false);
    });
  }, [uid]);
  return { data, isLoading };
}

export async function saveTaskPlan(uid: string, plan: Omit<WeeklyTaskPlan, "id" | "createdAt" | "updatedAt">) {
  const { db } = requireFirebase();
  const ref = await addDoc(collection(db, "weeklyTaskPlans"), {
    ...plan,
    userId: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTaskCompletion(uid: string, plan: WeeklyTaskPlan, taskId: string, completed: boolean) {
  const { db } = requireFirebase();
  const tasks = plan.tasks.map((task) => task.id === taskId ? { ...task, completed } : task);
  await updateDoc(doc(db, "weeklyTaskPlans", plan.id), { tasks, updatedAt: serverTimestamp() });
}

export async function deleteTaskPlan(uid: string, planId: string) {
  const { db } = requireFirebase();
  await deleteDoc(doc(db, "weeklyTaskPlans", planId));
}

export function startOfWeek(date = new Date()) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = next.getDate() - day + (day === 0 ? -6 : 1);
  next.setDate(diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function inferGrowthPhase(ageRange: PaddyAgeRange): GrowthPhase {
  if (ageRange === "0-30") return "nursery";
  if (ageRange === "31-60") return "vegetative";
  return "reproductive";
}

export function farmSizeLabel(category: FarmSizeCategory) {
  if (category === "small") return "Small";
  if (category === "medium") return "Medium";
  return "Large";
}

export type FarmPlanContext = Pick<
  Farm,
  "id" | "name" | "location" | "latitude" | "longitude" |
  "environment" | "farmSizeCategory" | "paddyType" | "paddyAgeRange" | "growthPhase" |
  "mockWeather" | "notes"
>;

export type RecentDiseaseRef = {
  diseaseNameEn: string;
  severity: string;
  detectedAt: string;
};

export async function fetchDynamicWeeklyPlan(
  farm: FarmPlanContext,
  previousPlans: WeeklyTaskPlan[],
  recentDiseases: RecentDiseaseRef[] = [],
): Promise<Omit<WeeklyTaskPlan, "id" | "createdAt" | "updatedAt">> {
  const weekStart = startOfWeek(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const baseDue = weekStart.getTime();

  // Collect incomplete tasks from the most recent plan for this farm
  const farmPlans = previousPlans
    .filter((p) => p.farmId === farm.id)
    .sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime());
  const incompleteTasks = (farmPlans[0]?.tasks ?? [])
    .filter((t) => !t.completed)
    .map((t) => ({ title: t.title, category: t.category, priority: t.priority }));

  try {
    const res = await apiFetch("/api/ai/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationName: farm.location,
        latitude: farm.latitude,
        longitude: farm.longitude,
        environment: farm.environment,
        // Full weather context
        humidity: farm.mockWeather.humidity,
        temperature: farm.mockWeather.temperature,
        rainfall: farm.mockWeather.rainfall,
        windSpeed: farm.mockWeather.windSpeed,
        // Farm details
        paddyType: farm.paddyType,
        paddyAgeRange: farm.paddyAgeRange,
        growthPhase: farm.growthPhase,
        farmSizeCategory: farm.farmSizeCategory,
        notes: farm.notes,
        // Adaptive context
        incompleteTasks,
        recentDiseases,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error((errBody as any).message || "Failed to fetch AI plan");
    }

    const data = await res.json();

    const validCategories = ["fertilizer", "pesticide", "irrigation", "monitoring", "disease_follow_up"];
    const tasks: WeeklyTask[] = (data.tasks || []).map((t: any) => ({
      id: crypto.randomUUID(),
      title: t.titleEn || t.titleMs || t.title || "AI Suggested Task",
      titleMs: t.titleMs || t.title || "Tugas yang Dicadangkan AI",
      titleEn: t.titleEn || t.title || "AI Suggested Task",
      description: t.descriptionEn || t.descriptionMs || t.description || "No description provided.",
      descriptionMs: t.descriptionMs || t.description || "Tiada penerangan disediakan.",
      descriptionEn: t.descriptionEn || t.description || "No description provided.",
      category: validCategories.includes(t.category) ? t.category : "monitoring",
      priority: ["low", "medium", "high"].includes(t.priority) ? t.priority : "medium",
      dueDate: new Date(baseDue + (t.dayOffset || 1) * 24 * 60 * 60 * 1000).toISOString(),
      completed: false,
    }));

    if (tasks.length === 0) {
      tasks.push({
        id: crypto.randomUUID(),
        title: "Weekly field monitoring",
        description: "Standard checkup — AI returned no tasks.",
        category: "monitoring",
        priority: "medium",
        dueDate: new Date(baseDue + 1 * 24 * 60 * 60 * 1000).toISOString(),
        completed: false,
      });
    }

    return {
      farmId: farm.id,
      farmName: farm.name,
      weekStart: weekStart.toISOString(),
      source: "resource_planning",
      tasks,
    };
  } catch (error) {
    console.error("fetchDynamicWeeklyPlan error:", error);
    throw error;
  }
}

export async function fetchResourceInsights(
  farm: FarmPlanContext,
  pendingTaskCount: number,
  recentDiseases: RecentDiseaseRef[],
  language: "en" | "ms",
): Promise<string> {
  try {
    const res = await apiFetch("/api/ai/resource-insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationName: farm.location,
        environment: farm.environment,
        paddyType: farm.paddyType,
        paddyAgeRange: farm.paddyAgeRange,
        growthPhase: farm.growthPhase,
        farmSizeCategory: farm.farmSizeCategory,
        humidity: farm.mockWeather.humidity,
        temperature: farm.mockWeather.temperature,
        rainfall: farm.mockWeather.rainfall,
        pendingTaskCount,
        recentDiseases,
        language,
      }),
    });
    if (!res.ok) throw new Error("Insights request failed");
    const data = await res.json();
    return data.insight as string;
  } catch (error) {
    console.error("fetchResourceInsights error:", error);
    return "";
  }
}
