import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { updateTaskCompletion, useFarms, useTaskPlans } from "@/services/firestoreService";
import { weatherWarnings } from "@/lib/mockWeather";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, CloudSun, ListTodo, Info, Check } from "lucide-react";

export default function NotificationsPage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { data: farms } = useFarms(user?.id);
  const { data: plans } = useTaskPlans(user?.id);
  const taskAlerts = plans.flatMap((plan) => plan.tasks.filter((task) => !task.completed).map((task) => ({ plan, task })));
  const weatherAlerts = farms.flatMap((farm) => weatherWarnings(farm.mockWeather).map((warning) => ({ farm, warning })));

  const markDone = async (planId: string, taskId: string) => {
    if (!user) return;
    const plan = plans.find((item) => item.id === planId);
    if (plan) await updateTaskCompletion(user.id, plan, taskId, true);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-foreground">{t("notifications")}</h1><p className="text-muted-foreground text-sm mt-1">{lang === "ms" ? `${taskAlerts.length + weatherAlerts.length} peringatan aktif` : `${taskAlerts.length + weatherAlerts.length} active reminders`}</p></div></div>
      {taskAlerts.length === 0 && weatherAlerts.length === 0 ? <Card><CardContent className="py-12 text-center"><Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">{t("noNotifications")}</p></CardContent></Card> : <div className="space-y-3">
        {weatherAlerts.map(({ farm, warning }, index) => <Card key={`${farm.id}-${index}`} className="border-amber-300 bg-amber-50" data-testid={`notification-weather-${index}`}><CardContent className="py-3"><div className="flex items-start gap-3"><div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-100 text-amber-700"><CloudSun className="w-4 h-4" /></div><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-foreground">{farm.name}</p><p className="text-sm text-muted-foreground mt-0.5">{lang === "ms" ? warning.messageMs : warning.messageEn}</p><Badge className="text-xs mt-1.5 bg-amber-100 text-amber-800 border-0">{warning.severity}</Badge></div></div></CardContent></Card>)}
        {taskAlerts.map(({ plan, task }) => <Card key={task.id} className="border-primary/30 bg-primary/5" data-testid={`notification-task-${task.id}`}><CardContent className="py-3"><div className="flex items-start gap-3"><div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-100 text-blue-700"><ListTodo className="w-4 h-4" /></div><div className="flex-1 min-w-0"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold text-foreground">{(lang === "ms" ? task.titleMs : task.titleEn) || task.title}</p><p className="text-sm text-muted-foreground mt-0.5">{plan.farmName} • {new Date(task.dueDate).toLocaleDateString(lang === "ms" ? "ms-MY" : "en-MY")}</p><Badge className="text-xs mt-1.5 bg-primary/10 text-primary border-0">{task.category.replace(/_/g, " ")}</Badge></div><Button variant="ghost" size="icon" className="flex-shrink-0 h-7 w-7" onClick={() => markDone(plan.id, task.id)} data-testid={`button-mark-read-${task.id}`}><Check className="w-4 h-4 text-primary" /></Button></div></div></div></CardContent></Card>)}
        <Card><CardContent className="py-3 flex items-center gap-3 text-sm text-muted-foreground"><Info className="w-4 h-4" />{lang === "ms" ? "Peringatan dijana daripada data Firestore, cuaca mock, dan pelan tugasan mingguan." : "Reminders are generated from Firestore data, mock weather, and weekly task plans."}</CardContent></Card>
      </div>}
    </div>
  );
}
