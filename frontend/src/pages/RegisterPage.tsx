import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { firebaseErrorMessage, registerWithFirebase } from "@/services/firestoreService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Leaf } from "lucide-react";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  preferredLanguage: z.enum(["ms", "en"]),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
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
    defaultValues: { name: "", email: "", password: "", phone: "", preferredLanguage: lang },
  });

  const onSubmit = async (data: FormData) => {
    setServerError("");
    setIsPending(true);
    try {
      const profile = await registerWithFirebase({ ...data, phone: data.phone || null });
      setUser(profile);
      setLang(profile.preferredLanguage);
      setLocation("/");
    } catch (error) {
      setServerError(firebaseErrorMessage(error, lang, "register"));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
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
            <CardTitle className="text-xl">{t("registerTitle")}</CardTitle>
          </CardHeader>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              {serverError && (
                <Alert variant="destructive">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="name">{t("name")}</Label>
                <Input id="name" {...form.register("name")} data-testid="input-name" />
                {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input id="email" type="email" {...form.register("email")} data-testid="input-email" />
                {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Input id="password" type="password" {...form.register("password")} data-testid="input-password" />
                {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t("phone")} ({lang === "ms" ? "Pilihan" : "Optional"})</Label>
                <Input id="phone" type="tel" {...form.register("phone")} data-testid="input-phone" />
              </div>
              <div className="space-y-2">
                <Label>{t("language")}</Label>
                <Select onValueChange={(v) => form.setValue("preferredLanguage", v as "ms" | "en")} defaultValue={lang}>
                  <SelectTrigger data-testid="select-language"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ms">{t("malay")}</SelectItem>
                    <SelectItem value="en">{t("english")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isPending} data-testid="button-register-submit">
                {isPending ? t("loading") : t("register")}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                {t("hasAccount")} <Link href="/login"><span className="text-primary font-medium cursor-pointer hover:underline" data-testid="link-login">{t("login")}</span></Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
