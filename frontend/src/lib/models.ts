export type Language = "ms" | "en";
export type PaddyAgeRange = "0-30" | "31-60" | "61-90";
export type FarmSizeCategory = "small" | "medium" | "large";
export type GrowthPhase = "nursery" | "vegetative" | "reproductive" | "ripening" | "harvested";
export type Severity = "ringan" | "sedang" | "parah";
export type TaskCategory = "fertilizer" | "pesticide" | "irrigation" | "monitoring" | "disease_follow_up";
export type TaskPriority = "low" | "medium" | "high";

export type MockWeather = {
  temperature: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  condition: string;
  updatedAt: string;
};

export type Farm = {
  id: string;
  name: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  environment: string;
  paddyType: string;
  farmSizeCategory: FarmSizeCategory;
  paddyAgeRange: PaddyAgeRange;
  growthPhase: GrowthPhase;
  notes: string | null;
  mockWeather: MockWeather;
  createdAt: string;
  updatedAt: string;
};

export type DiseasePrediction = {
  id: string;
  farmId: string | null;
  disease: string;
  diseaseNameMs: string;
  diseaseNameEn: string;
  severity: Severity;
  confidencePercent: number;
  recommendationsMs: string[];
  recommendationsEn: string[];
  descriptionMs: string;
  descriptionEn: string;
  treatmentMs: string;
  treatmentEn: string;
  modelUsed: string;
  detectedAt: string;
};

export type WeeklyTask = {
  id: string;
  title: string;
  titleMs?: string;
  titleEn?: string;
  description: string;
  descriptionMs?: string;
  descriptionEn?: string;
  category: TaskCategory;
  priority: TaskPriority;
  dueDate: string;
  completed: boolean;
};

export type WeeklyTaskPlan = {
  id: string;
  farmId: string | null;
  farmName: string;
  weekStart: string;
  source: "resource_planning" | "disease_follow_up" | "manual";
  tasks: WeeklyTask[];
  createdAt: string;
  updatedAt: string;
};

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  preferredLanguage: Language;
};
