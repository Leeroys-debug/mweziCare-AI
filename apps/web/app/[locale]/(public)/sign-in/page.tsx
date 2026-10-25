"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@mwezicare/ui";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const t = useTranslations("SignIn");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { error: signInError } = await authClient.signIn.email({
        email,
        password,
      });
      if (signInError) {
        setError(t("errorGeneric"));
        return;
      }
      router.push("/track");
      router.refresh();
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("emailLabel")}
          <input
            type="email"
            inputMode="email"
            required
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 rounded-md border border-neutral-300 px-3 text-base dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("passwordLabel")}
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder={t("passwordPlaceholder")}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 rounded-md border border-neutral-300 px-3 text-base dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" size="lg" disabled={pending}>
          {t("submit")}
        </Button>

        <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">
          {t("noAccount")}{" "}
          <Link href="/sign-up" className="font-medium underline">
            {t("signUpLink")}
          </Link>
        </p>
      </form>
    </div>
  );
}
