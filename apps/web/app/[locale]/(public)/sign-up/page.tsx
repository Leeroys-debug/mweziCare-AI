"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@mwezicare/ui";
import { authClient } from "@/lib/auth-client";

export default function SignUpPage() {
  const t = useTranslations("SignUp");
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { error: signUpError } = await authClient.signUp.email({
        name,
        email,
        password,
      });
      if (signUpError) {
        setError(
          signUpError.code === "USER_ALREADY_EXISTS"
            ? t("errorExists")
            : t("errorGeneric"),
        );
        return;
      }
      router.push("/onboarding");
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
          {t("nameLabel")}
          <input
            type="text"
            required
            autoComplete="name"
            placeholder={t("namePlaceholder")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-12 rounded-md border border-neutral-300 px-3 text-base dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>

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
            minLength={8}
            autoComplete="new-password"
            placeholder={t("passwordPlaceholder")}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 rounded-md border border-neutral-300 px-3 text-base dark:border-neutral-700 dark:bg-neutral-900"
          />
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("passwordHint")}
          </span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" size="lg" disabled={pending}>
          {t("submit")}
        </Button>

        <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">
          {t("haveAccount")}{" "}
          <Link href="/sign-in" className="font-medium underline">
            {t("signInLink")}
          </Link>
        </p>
      </form>
    </div>
  );
}
