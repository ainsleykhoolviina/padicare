import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { isFirebaseConfigured } from "@/lib/firebase";
import { firebaseErrorMessage, getUserProfile, loginWithFirebase } from "@/services/firestoreService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Leaf, Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { t, lang, setLang } = useLanguage();
  const { user, setUser } = useAuth();
  const [, setLocation] = useLocation();
  const [serverError, setServerError] = useState("");
  const [isPending, setIsPending] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: FormData) => {
    setServerError("");
    setIsPending(true);
    try {
      const firebaseUser = await loginWithFirebase(data.email, data.password);
      const profile = await getUserProfile(firebaseUser.uid, { name: firebaseUser.displayName, email: firebaseUser.email });
      setUser(profile);
      setLang(profile.preferredLanguage);
      setLocation("/");
    } catch (error) {
      setServerError(firebaseErrorMessage(error, lang, "login"));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mb-3 shadow-lg">
            <Leaf className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">{t("appName")}</h1>
          <p className="text-muted-foreground mt-1">{t("tagline")}</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">{t("loginTitle")}</CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5" data-testid="button-lang-login">
                    <Globe className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase">{lang}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLang("ms")}>Bahasa Melayu {lang === "ms" && "✓"}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLang("en")}>English {lang === "en" && "✓"}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <CardDescription className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
              {isFirebaseConfigured
                ? (lang === "ms" ? "Log masuk dengan akaun Firebase anda." : "Sign in with your Firebase account.")
                : (lang === "ms" ? "Tetapkan kunci Firebase dalam .env untuk mengaktifkan log masuk." : "Set Firebase keys in .env to enable login.")}
            </CardDescription>
          </CardHeader>

          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              {serverError && (
                <Alert variant="destructive">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input id="email" type="email" placeholder="farmer@padicare.my" {...form.register("email")} data-testid="input-email" />
                {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Input id="password" type="password" placeholder="••••••••" {...form.register("password")} data-testid="input-password" />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isPending} data-testid="button-login-submit">
                {isPending ? t("loading") : t("login")}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                {t("noAccount")} <Link href="/register"><span className="text-primary font-medium cursor-pointer hover:underline" data-testid="link-register">{t("register")}</span></Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
