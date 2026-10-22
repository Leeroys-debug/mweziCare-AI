"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@mwezicare/ui";

type Step = "phone" | "code";

export default function SignInPage() {
  const t = useTranslations("SignIn");
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleRequestCode(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/v1/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone }),
      });
      if (!response.ok) {
        setError(response.status === 429 ? t("errorGeneric") : t("errorPhone"));
        return;
      }
      setStep("code");
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setPending(false);
    }
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/v1/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone, code }),
      });
      if (!response.ok) {
        setError(t("errorCode"));
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

      {step === "phone" ? (
        <form onSubmit={handleRequestCode} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("phoneLabel")}
            <input
              type="tel"
              inputMode="tel"
              required
              autoComplete="tel"
              placeholder={t("phonePlaceholder")}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="h-12 rounded-md border border-neutral-300 px-3 text-base dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" size="lg" disabled={pending}>
            {t("requestCode")}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("codeLabel")}
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              placeholder={t("codePlaceholder")}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="h-12 rounded-md border border-neutral-300 px-3 text-base tracking-widest dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" size="lg" disabled={pending}>
            {t("verify")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setStep("phone");
              setCode("");
              setError(null);
            }}
          >
            {t("changeNumber")}
          </Button>
        </form>
      )}
    </div>
  );
}
