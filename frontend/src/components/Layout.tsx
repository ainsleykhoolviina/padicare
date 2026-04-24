import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { logoutFromFirebase, useTaskPlans } from "@/services/firestoreService";
import {
  Home, ListTodo, Leaf, ScanLine, CloudSun, Bell, BookOpen, BarChart3, Menu, X, Globe, LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import AIAgent from "./AIAgent";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { t, lang, setLang } = useLanguage();
  const { user, setUser } = useAuth();
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifSeen, setNotifSeen] = useState(false);
  const { data: plans } = useTaskPlans(user?.id);

  const unreadCount = plans.flatMap((plan) => plan.tasks).filter((task) => !task.completed && new Date(task.dueDate) <= new Date(Date.now() + 48 * 60 * 60 * 1000)).length;

  // Reset seen when new notifications come in
  const prevCountRef = useState(unreadCount);
  if (prevCountRef[0] !== unreadCount) {
    prevCountRef[0] = unreadCount;
    if (unreadCount > (prevCountRef[0] ?? 0)) setNotifSeen(false);
  }

  const showBadge = !notifSeen && unreadCount > 0;

  const handleLogout = async () => {
    await logoutFromFirebase();
    setUser(null);
    setLocation("/login");
  };

  const navItems = [
    { path: "/", icon: Home, label: t("home") },
    { path: "/tasks", icon: ListTodo, label: t("tasks") },
    { path: "/farms", icon: Leaf, label: t("myFarm") },
    { path: "/disease", icon: ScanLine, label: t("diseaseDetection") },
    { path: "/resources", icon: BarChart3, label: t("resources") },
    { path: "/weather", icon: CloudSun, label: t("weather") },
    { path: "/tutorial", icon: BookOpen, label: t("tutorial") },
  ];

  const isActive = (path: string) => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 nav-glass">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1.5 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileOpen(!mobileOpen)} data-testid="button-menu-toggle">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer float-hover">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-md">
                  <Leaf className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="font-bold text-foreground text-lg hidden sm:block">{t("appName")}</span>
              </div>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ path, icon: Icon, label }) => (
              <Link key={path} href={path}>
                <button data-testid={`nav-${path.replace("/", "") || "home"}`} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isActive(path) ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-muted hover:shadow-sm"}`}>
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/notifications">
              <button
                data-testid="button-notifications"
                className="relative p-2 rounded-lg hover:bg-muted transition-colors float-hover"
                onClick={() => setNotifSeen(true)}
              >
                <Bell className="w-5 h-5 text-foreground" />
                {showBadge && (
                  <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs bg-destructive text-destructive-foreground shadow-md" data-testid="badge-unread-count">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Badge>
                )}
              </button>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 float-hover" data-testid="button-language-toggle">
                  <Globe className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase">{lang}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-panel">
                <DropdownMenuItem onClick={() => setLang("ms")} data-testid="menu-item-lang-ms">Bahasa Melayu {lang === "ms" && "✓"}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLang("en")} data-testid="menu-item-lang-en">English {lang === "en" && "✓"}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5 float-hover" data-testid="button-user-menu">
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shadow-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden sm:inline text-sm">{user.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass-panel">
                  <DropdownMenuItem onClick={handleLogout} data-testid="menu-item-logout">
                    <LogOut className="w-4 h-4 mr-2" />
                    {t("logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)}
          >
            <motion.div 
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute left-0 top-0 bottom-0 w-64 glass-panel border-r border-border p-4 pt-14" onClick={(e) => e.stopPropagation()}
            >
              <nav className="flex flex-col gap-1 mt-4">
                {navItems.map(({ path, icon: Icon, label }) => (
                  <Link key={path} href={path}>
                    <button onClick={() => setMobileOpen(false)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive(path) ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-muted"}`}>
                      <Icon className="w-5 h-5" />
                      <span>{label}</span>
                    </button>
                  </Link>
                ))}
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <AIAgent />
    </div>
  );
}
