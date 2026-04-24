import { useState } from "react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { deleteFarm, useFarms } from "@/services/firestoreService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Leaf, Plus, Trash2, Edit, MapPin, ChevronRight, Droplets } from "lucide-react";
import FarmMapOverlay from "@/components/FarmMapOverlay";

const phaseColors: Record<string, string> = { nursery: "bg-blue-100 text-blue-700", vegetative: "bg-green-100 text-green-700", reproductive: "bg-amber-100 text-amber-700", ripening: "bg-orange-100 text-orange-700", harvested: "bg-gray-100 text-gray-700" };
const ageProgress = { "0-30": 25, "31-60": 60, "61-90": 90 };

export default function FarmsPage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { data: farms, isLoading } = useFarms(user?.id);

  const handleDelete = async () => {
    if (!deleteId || !user) return;
    setIsDeleting(true);
    await deleteFarm(user.id, deleteId);
    setIsDeleting(false);
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-foreground">{t("myFarm")}</h1><p className="text-muted-foreground text-sm mt-1">{lang === "ms" ? "Urus semua ladang padi anda" : "Manage all your paddy farms"}</p></div><Link href="/farms/new"><Button data-testid="button-add-farm" className="gap-2"><Plus className="w-4 h-4" />{t("addFarm")}</Button></Link></div>
      {isLoading ? <div className="grid md:grid-cols-2 gap-4">{[...Array(3)].map((_, i) => <Card key={i}><CardContent className="pt-4"><Skeleton className="h-32 w-full" /></CardContent></Card>)}</div> : farms.length === 0 ? <Card><CardContent className="pt-8 pb-8 flex flex-col items-center text-center"><div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4"><Leaf className="w-8 h-8 text-primary" /></div><p className="text-muted-foreground">{t("noFarms")}</p><Link href="/farms/new"><Button className="mt-4 gap-2 float-hover" data-testid="button-add-first-farm"><Plus className="w-4 h-4" />{t("addFarm")}</Button></Link></CardContent></Card> : <div className="grid md:grid-cols-2 gap-4">{farms.map((farm) => <Card key={farm.id} className="float-hover" data-testid={`farm-card-${farm.id}`}><CardHeader className="pb-3"><div className="flex items-start justify-between"><div><CardTitle className="text-base">{farm.name}</CardTitle><div className="flex items-center gap-1 mt-1 text-muted-foreground"><MapPin className="w-3 h-3" /><span className="text-xs">{farm.location}</span></div></div><Badge className={`text-xs ${phaseColors[farm.growthPhase] || ""}`}>{t(farm.growthPhase as any)}</Badge></div></CardHeader><CardContent className="space-y-3"><div><div className="flex items-center justify-between text-xs text-muted-foreground mb-1"><span>{lang === "ms" ? "Kemajuan pertumbuhan" : "Growth progress"}</span><span>{ageProgress[farm.paddyAgeRange as keyof typeof ageProgress] || 0}%</span></div><div className="w-full bg-muted rounded-full h-2"><div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${ageProgress[farm.paddyAgeRange as keyof typeof ageProgress] || 0}%` }} /></div></div><div className="grid grid-cols-3 gap-2 text-xs"><div><p className="text-muted-foreground">{t("type")}</p><p className="font-medium">{farm.paddyType}</p></div><div><p className="text-muted-foreground">{t("size")}</p><p className="font-medium">{sizeLabel(farm.farmSizeCategory, lang)}</p></div><div><p className="text-muted-foreground">{t("paddyAge")}</p><p className="font-medium">{farm.paddyAgeRange} {lang === "ms" ? "hari" : "days"}</p></div></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><Droplets className="w-3 h-3 text-blue-500" />{farm.mockWeather.humidity}% {t("humidity")} • {farm.environment}</div><FarmMapOverlay farm={farm} /><div className="flex items-center gap-2 pt-1"><Link href={`/farms/${farm.id}`} className="flex-1"><Button variant="outline" size="sm" className="w-full gap-1 float-hover" data-testid={`button-view-farm-${farm.id}`}>{t("viewDetails")}<ChevronRight className="w-3 h-3" /></Button></Link><Link href={`/farms/${farm.id}/edit`}><Button variant="ghost" size="sm" className="float-hover" data-testid={`button-edit-farm-${farm.id}`}><Edit className="w-4 h-4" /></Button></Link><Button variant="ghost" size="sm" onClick={() => setDeleteId(farm.id)} className="text-destructive hover:text-destructive float-hover" data-testid={`button-delete-farm-${farm.id}`}><Trash2 className="w-4 h-4" /></Button></div></CardContent></Card>)}</div>}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("deleteConfirm")}</AlertDialogTitle><AlertDialogDescription>{lang === "ms" ? "Tindakan ini tidak boleh dibatalkan." : "This action cannot be undone."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("cancel")}</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">{isDeleting ? t("loading") : t("delete")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}

function sizeLabel(size: string, lang: string) {
  if (lang === "ms") return size === "small" ? "Kecil" : size === "medium" ? "Sederhana" : "Besar";
  return size === "small" ? "Small" : size === "medium" ? "Medium" : "Large";
}
