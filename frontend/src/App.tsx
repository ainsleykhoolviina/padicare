import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import FarmsPage from "@/pages/FarmsPage";
import FarmFormPage from "@/pages/FarmFormPage";
import FarmDetailPage from "@/pages/FarmDetailPage";
import TasksPage from "@/pages/TasksPage";
import DiseaseDetectionPage from "@/pages/DiseaseDetectionPage";
import ResourcesPage from "@/pages/ResourcesPage";
import WeatherPage from "@/pages/WeatherPage";
import NotificationsPage from "@/pages/NotificationsPage";
import TutorialPage from "@/pages/TutorialPage";
import { useEffect } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    }
  }
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">PadiCare...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <Layout>{children}</Layout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/">
        {() => (
          <AuthGuard>
            <DashboardPage />
          </AuthGuard>
        )}
      </Route>
      <Route path="/farms/new">
        {() => (
          <AuthGuard>
            <FarmFormPage />
          </AuthGuard>
        )}
      </Route>
      <Route path="/farms/:farmId/edit">
        {(params) => (
          <AuthGuard>
            <FarmFormPage />
          </AuthGuard>
        )}
      </Route>
      <Route path="/farms/:farmId">
        {() => (
          <AuthGuard>
            <FarmDetailPage />
          </AuthGuard>
        )}
      </Route>
      <Route path="/farms">
        {() => (
          <AuthGuard>
            <FarmsPage />
          </AuthGuard>
        )}
      </Route>
      <Route path="/tasks">
        {() => (
          <AuthGuard>
            <TasksPage />
          </AuthGuard>
        )}
      </Route>
      <Route path="/disease">
        {() => (
          <AuthGuard>
            <DiseaseDetectionPage />
          </AuthGuard>
        )}
      </Route>
      <Route path="/resources">
        {() => (
          <AuthGuard>
            <ResourcesPage />
          </AuthGuard>
        )}
      </Route>
      <Route path="/weather">
        {() => (
          <AuthGuard>
            <WeatherPage />
          </AuthGuard>
        )}
      </Route>
      <Route path="/notifications">
        {() => (
          <AuthGuard>
            <NotificationsPage />
          </AuthGuard>
        )}
      </Route>
      <Route path="/tutorial">
        {() => (
          <AuthGuard>
            <TutorialPage />
          </AuthGuard>
        )}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
