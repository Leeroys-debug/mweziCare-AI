"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { evaluate, urgentOnlyRuleset } from "@mwezicare/rules-engine";
import { extractRedFlagFeatures } from "@mwezicare/triage";
import {
  MINOR_AGE_BANDS,
  bleedingLevelSchema,
  painLocationSchema,
  type SymptomLogInput,
} from "@mwezicare/validation";
import { Button, Chip, PainSlider } from "@mwezicare/ui";
import { useProfile } from "@/hooks/use-profile";
import { offlineDb } from "@/lib/offline-db";
import { saveLog } from "@/lib/sync-engine";

const PAIN_LOCATIONS = painLocationSchema.options;
const BLEEDING_LEVELS = bleedingLevelSchema.options;

const formSchema = z.object({
  periodDay: z.boolean(),
  bleedingLevel: bleedingLevelSchema.nullable(),
  painScore: z.number().int().min(0).max(10),
  painLocations: z.array(painLocationSchema),
  fatigue: z.boolean(),
  nausea: z.boolean(),
  painWithBowelMovements: z.boolean(),
  painWithUrination: z.boolean(),
  painWithSex: z.boolean(),
  missedSchool: z.boolean(),
  missedWork: z.boolean(),
  sleepDisrupted: z.boolean(),
  activitiesLimited: z.boolean(),
  suddenSeverePain: z.boolean(),
  fainting: z.boolean(),
  possiblePregnancySuspected: z.boolean(),
  notes: z.string().max(2000).nullable(),
});
type FormValues = z.infer<typeof formSchema>;

const DEFAULT_VALUES: FormValues = {
  periodDay: false,
  bleedingLevel: null,
  painScore: 0,
  painLocations: [],
  fatigue: false,
  nausea: false,
  painWithBowelMovements: false,
  painWithUrination: false,
  painWithSex: false,
  missedSchool: false,
  missedWork: false,
  sleepDisrupted: false,
  activitiesLimited: false,
  suddenSeverePain: false,
  fainting: false,
  possiblePregnancySuspected: false,
  notes: null,
};

export interface DailyLogFormProps {
  /** YYYY-MM-DD, the day this log is for. */
  date: string;
  onSaved?: () => void;
  onUrgent?: () => void;
}

/**
 * The daily log form — large tap targets, sensible all-false/zero defaults
 * so a routine day can be saved in a few taps. Writes offline-first via
 * saveLog() (packages/db upserts by date once synced), then runs the
 * client-side red-flag pre-check so the urgent overlay can appear
 * immediately, even offline (CLAUDE.md: urgency is only ever decided by the
 * rules engine, never implied by UI copy).
 */
export function DailyLogForm({ date, onSaved, onUrgent }: DailyLogFormProps) {
  const t = useTranslations("Track");
  const { data: profile } = useProfile();
  const showPainWithSex =
    profile != null && !MINOR_AGE_BANDS.has(profile.ageBand);

  const [clientId, setClientId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const { control, handleSubmit, reset, watch, setValue } = useForm<FormValues>(
    {
      resolver: zodResolver(formSchema),
      defaultValues: DEFAULT_VALUES,
    },
  );

  useEffect(() => {
    let active = true;
    setSaveState("idle");
    void (async () => {
      const existing = await offlineDb.logs
        .where("logDate")
        .equals(date)
        .first();
      if (!active) return;
      if (existing) {
        setClientId(existing.clientId);
        reset({
          periodDay: existing.periodDay,
          bleedingLevel: existing.bleedingLevel ?? null,
          painScore: existing.painScore ?? 0,
          painLocations: (existing.painLocations ??
            []) as FormValues["painLocations"],
          fatigue: existing.symptoms.fatigue ?? false,
          nausea: existing.symptoms.nausea ?? false,
          painWithBowelMovements:
            existing.symptoms.painWithBowelMovements ?? false,
          painWithUrination: existing.symptoms.painWithUrination ?? false,
          painWithSex: existing.symptoms.painWithSex ?? false,
          missedSchool: existing.impact.missedSchool ?? false,
          missedWork: existing.impact.missedWork ?? false,
          sleepDisrupted: existing.impact.sleepDisrupted ?? false,
          activitiesLimited: existing.impact.activitiesLimited ?? false,
          suddenSeverePain: existing.redFlags.suddenSeverePain ?? false,
          fainting: existing.redFlags.fainting ?? false,
          possiblePregnancySuspected:
            existing.redFlags.possiblePregnancySuspected ?? false,
          notes: existing.notes ?? null,
        });
      } else {
        setClientId(crypto.randomUUID());
        reset(DEFAULT_VALUES);
      }
    })();
    return () => {
      active = false;
    };
  }, [date, reset]);

  const painLocations = watch("painLocations");
  function toggleLocation(location: (typeof PAIN_LOCATIONS)[number]) {
    setValue(
      "painLocations",
      painLocations.includes(location)
        ? painLocations.filter((l) => l !== location)
        : [...painLocations, location],
      { shouldDirty: true },
    );
  }

  async function onSubmit(values: FormValues) {
    if (!clientId) return;
    setSaveState("saving");

    const log: SymptomLogInput = {
      clientId,
      logDate: date,
      periodDay: values.periodDay,
      bleedingLevel: values.bleedingLevel,
      painScore: values.painScore,
      painLocations: values.painLocations,
      symptoms: {
        fatigue: values.fatigue,
        nausea: values.nausea,
        painWithBowelMovements: values.painWithBowelMovements,
        painWithUrination: values.painWithUrination,
        ...(showPainWithSex ? { painWithSex: values.painWithSex } : {}),
      },
      impact: {
        missedSchool: values.missedSchool,
        missedWork: values.missedWork,
        sleepDisrupted: values.sleepDisrupted,
        activitiesLimited: values.activitiesLimited,
      },
      redFlags: {
        suddenSeverePain: values.suddenSeverePain,
        fainting: values.fainting,
        possiblePregnancySuspected: values.possiblePregnancySuspected,
      },
      notes: values.notes,
      updatedAt: new Date().toISOString(),
    };

    await saveLog(log);
    setSaveState("saved");
    onSaved?.();

    const redFlagResult = evaluate(
      urgentOnlyRuleset,
      extractRedFlagFeatures(log),
    );
    if (redFlagResult.outcome === "urgent") {
      onUrgent?.();
    }
  }

  const painScoreLabels = Array.from({ length: 11 }, (_, i) =>
    t(`painScoreLabel.${i}`),
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <Controller
        control={control}
        name="periodDay"
        render={({ field }) => (
          <Chip
            selected={field.value}
            onClick={() => field.onChange(!field.value)}
          >
            {t("periodDay")}
          </Chip>
        )}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("bleedingLevelLabel")}
        </legend>
        <Controller
          control={control}
          name="bleedingLevel"
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {BLEEDING_LEVELS.map((level) => (
                <Chip
                  key={level}
                  selected={field.value === level}
                  onClick={() =>
                    field.onChange(field.value === level ? null : level)
                  }
                >
                  {t(`bleedingLevel.${level}`)}
                </Chip>
              ))}
            </div>
          )}
        />
      </fieldset>

      <Controller
        control={control}
        name="painScore"
        render={({ field }) => (
          <PainSlider
            value={field.value}
            onChange={field.onChange}
            label={t("painScoreLabel.title")}
            valueLabels={painScoreLabels}
          />
        )}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("painLocationsLabel")}
        </legend>
        <div className="flex flex-wrap gap-2">
          {PAIN_LOCATIONS.map((location) => (
            <Chip
              key={location}
              selected={painLocations.includes(location)}
              onClick={() => toggleLocation(location)}
            >
              {t(`painLocation.${location}`)}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("symptomsLabel")}
        </legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              "fatigue",
              "nausea",
              "painWithBowelMovements",
              "painWithUrination",
              ...(showPainWithSex ? (["painWithSex"] as const) : []),
            ] as const
          ).map((symptom) => (
            <Controller
              key={symptom}
              control={control}
              name={symptom}
              render={({ field }) => (
                <Chip
                  selected={field.value}
                  onClick={() => field.onChange(!field.value)}
                >
                  {t(`symptom.${symptom}`)}
                </Chip>
              )}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("impactLabel")}
        </legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              "missedSchool",
              "missedWork",
              "sleepDisrupted",
              "activitiesLimited",
            ] as const
          ).map((impact) => (
            <Controller
              key={impact}
              control={control}
              name={impact}
              render={({ field }) => (
                <Chip
                  selected={field.value}
                  onClick={() => field.onChange(!field.value)}
                >
                  {t(`impact.${impact}`)}
                </Chip>
              )}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
        <legend className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {t("safetyCheckLabel")}
        </legend>
        <p className="text-xs text-amber-800 dark:text-amber-300">
          {t("safetyCheckHint")}
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              "suddenSeverePain",
              "fainting",
              "possiblePregnancySuspected",
            ] as const
          ).map((flag) => (
            <Controller
              key={flag}
              control={control}
              name={flag}
              render={({ field }) => (
                <Chip
                  selected={field.value}
                  onClick={() => field.onChange(!field.value)}
                >
                  {t(`redFlag.${flag}`)}
                </Chip>
              )}
            />
          ))}
        </div>
      </fieldset>

      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {t("notesLabel")}
            </span>
            <textarea
              value={field.value ?? ""}
              onChange={(e) =>
                field.onChange(
                  e.target.value.length > 0 ? e.target.value : null,
                )
              }
              rows={3}
              className="rounded-md border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              placeholder={t("notesPlaceholder")}
            />
          </label>
        )}
      />

      <Button type="submit" size="lg" disabled={!clientId}>
        {saveState === "saving" ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
