import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { Cycle } from "@mwezicare/triage";
import type { TriageOutcome } from "@mwezicare/rules-engine";

export interface MyDataPdfLabels {
  title: string;
  generatedAtLabel: string;
  profileTitle: string;
  ageBandLabel: string;
  countyLabel: string;
  familyHistoryLabel: string;
  familyHistoryYes: string;
  familyHistoryNo: string;
  familyHistoryNotAnswered: string;
  noProfileLabel: string;
  consentsTitle: string;
  consentColumn: string;
  statusColumn: string;
  consentGranted: string;
  consentNotGranted: string;
  cyclesTitle: string;
  cycleStartColumn: string;
  periodLengthColumn: string;
  cycleLengthColumn: string;
  daysUnit: string;
  logsTitle: string;
  dateColumn: string;
  periodDayColumn: string;
  bleedingColumn: string;
  painColumn: string;
  symptomsColumn: string;
  impactColumn: string;
  notesColumn: string;
  yes: string;
  no: string;
  symptomLabels: Record<string, string>;
  impactLabels: Record<string, string>;
  bleedingLabels: Record<string, string>;
  assessmentsTitle: string;
  assessmentDateColumn: string;
  outcomeColumn: string;
  rulesetVersionColumn: string;
  reasonsColumn: string;
  outcomeLabels: Record<TriageOutcome, string>;
  summariesTitle: string;
  summaryCreatedColumn: string;
  summaryPeriodColumn: string;
  summaryStatusColumn: string;
  summaryStatusActive: string;
  summaryStatusExpired: string;
  summaryStatusRevoked: string;
  noDataLabel: string;
  footer: string;
}

export interface MyDataPdfProfile {
  ageBand: string;
  county: string | null;
  familyHistoryEndometriosis: boolean | null;
}

export interface MyDataPdfConsent {
  purpose: string;
  grantedAt: Date | null;
  withdrawnAt: Date | null;
}

export interface MyDataPdfLog {
  logDate: string;
  periodDay: boolean;
  bleedingLevel: string | null;
  painScore: number | null;
  symptoms: Record<string, boolean>;
  impact: Record<string, boolean>;
  notes: string | null;
}

export interface MyDataPdfAssessment {
  createdAt: Date;
  outcome: TriageOutcome;
  reasons: { en: string; sw: string }[];
  rulesetVersion: number;
}

export interface MyDataPdfSummary {
  createdAt: Date;
  period: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface MyDataPdfInput {
  exportedAt: string;
  locale: string;
  profile: MyDataPdfProfile | null;
  consents: MyDataPdfConsent[];
  cycles: Cycle[];
  logs: MyDataPdfLog[];
  assessments: MyDataPdfAssessment[];
  summaries: MyDataPdfSummary[];
  labels: MyDataPdfLabels;
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#555555", marginBottom: 16 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginBottom: 6 },
  row: {
    flexDirection: "row",
    borderBottom: "1pt solid #e5e5e5",
    paddingVertical: 3,
  },
  headerRow: {
    flexDirection: "row",
    borderBottom: "1pt solid #333333",
    paddingVertical: 3,
    fontWeight: 700,
  },
  cell: { flex: 1 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    fontSize: 8,
    color: "#777777",
    textAlign: "center",
  },
});

function dateOnly(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "—";
}

function familyHistoryText(
  value: boolean | null,
  labels: MyDataPdfLabels,
): string {
  if (value === true) return labels.familyHistoryYes;
  if (value === false) return labels.familyHistoryNo;
  return labels.familyHistoryNotAnswered;
}

function namesWhereTrue(
  flags: Record<string, boolean>,
  nameFor: Record<string, string>,
): string {
  const on = Object.entries(flags)
    .filter(([, value]) => value)
    .map(([key]) => nameFor[key] ?? key);
  return on.length > 0 ? on.join(", ") : "—";
}

function summaryStatus(
  summary: MyDataPdfSummary,
  labels: MyDataPdfLabels,
): string {
  if (summary.revokedAt) return labels.summaryStatusRevoked;
  if (summary.expiresAt < new Date()) return labels.summaryStatusExpired;
  return labels.summaryStatusActive;
}

function MyDataDocument({ data }: { data: MyDataPdfInput }) {
  const { labels } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{labels.title}</Text>
        <Text style={styles.subtitle}>
          {labels.generatedAtLabel}: {dateOnly(new Date(data.exportedAt))}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.profileTitle}</Text>
          {data.profile ? (
            <>
              <Text>
                {labels.ageBandLabel}: {data.profile.ageBand}
              </Text>
              <Text>
                {labels.countyLabel}: {data.profile.county ?? "—"}
              </Text>
              <Text>
                {labels.familyHistoryLabel}:{" "}
                {familyHistoryText(
                  data.profile.familyHistoryEndometriosis,
                  labels,
                )}
              </Text>
            </>
          ) : (
            <Text>{labels.noProfileLabel}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.consentsTitle}</Text>
          <View style={styles.headerRow}>
            <Text style={styles.cell}>{labels.consentColumn}</Text>
            <Text style={styles.cell}>{labels.statusColumn}</Text>
          </View>
          {data.consents.map((consent) => (
            <View style={styles.row} key={consent.purpose}>
              <Text style={styles.cell}>{consent.purpose}</Text>
              <Text style={styles.cell}>
                {consent.grantedAt && !consent.withdrawnAt
                  ? labels.consentGranted
                  : labels.consentNotGranted}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.cyclesTitle}</Text>
          {data.cycles.length === 0 ? (
            <Text>{labels.noDataLabel}</Text>
          ) : (
            <>
              <View style={styles.headerRow}>
                <Text style={styles.cell}>{labels.cycleStartColumn}</Text>
                <Text style={styles.cell}>{labels.periodLengthColumn}</Text>
                <Text style={styles.cell}>{labels.cycleLengthColumn}</Text>
              </View>
              {data.cycles.map((cycle) => (
                <View style={styles.row} key={cycle.startDate}>
                  <Text style={styles.cell}>{cycle.startDate}</Text>
                  <Text style={styles.cell}>
                    {cycle.periodLengthDays} {labels.daysUnit}
                  </Text>
                  <Text style={styles.cell}>
                    {cycle.cycleLengthDays != null
                      ? `${cycle.cycleLengthDays} ${labels.daysUnit}`
                      : "—"}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.logsTitle}</Text>
          {data.logs.length === 0 ? (
            <Text>{labels.noDataLabel}</Text>
          ) : (
            <>
              <View style={styles.headerRow}>
                <Text style={{ flex: 1.1 }}>{labels.dateColumn}</Text>
                <Text style={{ flex: 0.8 }}>{labels.periodDayColumn}</Text>
                <Text style={{ flex: 1 }}>{labels.bleedingColumn}</Text>
                <Text style={{ flex: 0.6 }}>{labels.painColumn}</Text>
                <Text style={{ flex: 2 }}>{labels.symptomsColumn}</Text>
                <Text style={{ flex: 1.5 }}>{labels.impactColumn}</Text>
                <Text style={{ flex: 2 }}>{labels.notesColumn}</Text>
              </View>
              {data.logs.map((log) => (
                <View style={styles.row} key={log.logDate}>
                  <Text style={{ flex: 1.1 }}>{log.logDate}</Text>
                  <Text style={{ flex: 0.8 }}>
                    {log.periodDay ? labels.yes : labels.no}
                  </Text>
                  <Text style={{ flex: 1 }}>
                    {log.bleedingLevel
                      ? (labels.bleedingLabels[log.bleedingLevel] ??
                        log.bleedingLevel)
                      : "—"}
                  </Text>
                  <Text style={{ flex: 0.6 }}>
                    {log.painScore != null ? log.painScore : "—"}
                  </Text>
                  <Text style={{ flex: 2 }}>
                    {namesWhereTrue(log.symptoms, labels.symptomLabels)}
                  </Text>
                  <Text style={{ flex: 1.5 }}>
                    {namesWhereTrue(log.impact, labels.impactLabels)}
                  </Text>
                  <Text style={{ flex: 2 }}>{log.notes ?? "—"}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.assessmentsTitle}</Text>
          {data.assessments.length === 0 ? (
            <Text>{labels.noDataLabel}</Text>
          ) : (
            <>
              <View style={styles.headerRow}>
                <Text style={{ flex: 1 }}>{labels.assessmentDateColumn}</Text>
                <Text style={{ flex: 1 }}>{labels.outcomeColumn}</Text>
                <Text style={{ flex: 1 }}>{labels.rulesetVersionColumn}</Text>
                <Text style={{ flex: 3 }}>{labels.reasonsColumn}</Text>
              </View>
              {data.assessments.map((assessment, i) => (
                <View style={styles.row} key={i}>
                  <Text style={{ flex: 1 }}>
                    {dateOnly(assessment.createdAt)}
                  </Text>
                  <Text style={{ flex: 1 }}>
                    {labels.outcomeLabels[assessment.outcome]}
                  </Text>
                  <Text style={{ flex: 1 }}>{assessment.rulesetVersion}</Text>
                  <Text style={{ flex: 3 }}>
                    {assessment.reasons
                      .map((reason) =>
                        data.locale === "sw" ? reason.sw : reason.en,
                      )
                      .join("; ") || "—"}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.summariesTitle}</Text>
          {data.summaries.length === 0 ? (
            <Text>{labels.noDataLabel}</Text>
          ) : (
            <>
              <View style={styles.headerRow}>
                <Text style={styles.cell}>{labels.summaryCreatedColumn}</Text>
                <Text style={styles.cell}>{labels.summaryPeriodColumn}</Text>
                <Text style={styles.cell}>{labels.summaryStatusColumn}</Text>
              </View>
              {data.summaries.map((summary, i) => (
                <View style={styles.row} key={i}>
                  <Text style={styles.cell}>{dateOnly(summary.createdAt)}</Text>
                  <Text style={styles.cell}>{summary.period}</Text>
                  <Text style={styles.cell}>
                    {summaryStatus(summary, labels)}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>

        <Text style={styles.footer} fixed>
          {labels.footer}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderMyDataPdf(data: MyDataPdfInput): Promise<Buffer> {
  return renderToBuffer(<MyDataDocument data={data} />);
}
