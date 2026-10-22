import {
  Document,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { SummaryData } from "@mwezicare/triage";
import type { TriageOutcome } from "@mwezicare/rules-engine";

export interface SummaryPdfLabels {
  title: string;
  dateRangeLabel: string;
  displayLabelFallback: string;
  ageBandLabel: string;
  cyclesTitle: string;
  cycleStartColumn: string;
  periodLengthColumn: string;
  cycleLengthColumn: string;
  daysUnit: string;
  painChartTitle: string;
  maxPainLegend: string;
  avgPainLegend: string;
  symptomFrequencyTitle: string;
  symptomLabels: Record<string, string>;
  missedSchoolLabel: string;
  missedWorkLabel: string;
  assessmentTitle: string;
  assessmentUnavailable: string;
  outcomeLabels: Record<TriageOutcome, string>;
  rulesetVersionLabel: string;
  noDataLabel: string;
  footer: string;
}

export interface SummaryPdfMeta {
  displayLabel?: string;
  ageBand: string;
  locale: string;
  labels: SummaryPdfLabels;
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#555555", marginBottom: 16 },
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
  chart: { marginTop: 4 },
  legendRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", marginRight: 12 },
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

const CHART_WIDTH = 480;
const CHART_HEIGHT = 120;
const CHART_PADDING = 16;

function painChartPath(values: number[]): string {
  if (values.length === 0) return "";
  const innerWidth = CHART_WIDTH - CHART_PADDING * 2;
  const innerHeight = CHART_HEIGHT - CHART_PADDING * 2;
  const step = values.length > 1 ? innerWidth / (values.length - 1) : 0;

  return values
    .map((value, i) => {
      const x = CHART_PADDING + i * step;
      const y =
        CHART_PADDING +
        innerHeight -
        (Math.max(0, Math.min(10, value)) / 10) * innerHeight;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function PainChart({
  data,
  labels,
}: {
  data: SummaryData["painChart"];
  labels: SummaryPdfLabels;
}) {
  if (data.length === 0) {
    return <Text>{labels.noDataLabel}</Text>;
  }
  return (
    <View style={styles.chart}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Path
          d={painChartPath(data.map((d) => d.maxPainScore))}
          stroke="#be123c"
          strokeWidth={1.5}
          fill="none"
        />
        <Path
          d={painChartPath(data.map((d) => d.avgPainScore))}
          stroke="#f59e0b"
          strokeWidth={1.5}
          fill="none"
        />
      </Svg>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#be123c" }]} />
          <Text>{labels.maxPainLegend}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#f59e0b" }]} />
          <Text>{labels.avgPainLegend}</Text>
        </View>
      </View>
    </View>
  );
}

function SummaryDocument({
  data,
  meta,
}: {
  data: SummaryData;
  meta: SummaryPdfMeta;
}) {
  const { labels } = meta;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{labels.title}</Text>
        <Text style={styles.subtitle}>
          {meta.displayLabel || labels.displayLabelFallback} ·{" "}
          {labels.ageBandLabel}: {meta.ageBand} · {labels.dateRangeLabel}:{" "}
          {data.from} – {data.to}
        </Text>

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
          <Text style={styles.sectionTitle}>{labels.painChartTitle}</Text>
          <PainChart data={data.painChart} labels={labels} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {labels.symptomFrequencyTitle}
          </Text>
          <View style={styles.headerRow}>
            <Text style={styles.cell}> </Text>
            <Text style={styles.cell}>{labels.daysUnit}</Text>
          </View>
          {data.symptomFrequency.map((entry) => (
            <View style={styles.row} key={entry.symptom}>
              <Text style={styles.cell}>
                {labels.symptomLabels[entry.symptom] ?? entry.symptom}
              </Text>
              <Text style={styles.cell}>{entry.days}</Text>
            </View>
          ))}
          <View style={styles.row}>
            <Text style={styles.cell}>{labels.missedSchoolLabel}</Text>
            <Text style={styles.cell}>{data.missedSchoolDays}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cell}>{labels.missedWorkLabel}</Text>
            <Text style={styles.cell}>{data.missedWorkDays}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.assessmentTitle}</Text>
          {data.assessment ? (
            <>
              <Text>{labels.outcomeLabels[data.assessment.outcome]}</Text>
              <Text>
                {labels.rulesetVersionLabel}: {data.assessment.rulesetVersion}
              </Text>
              {data.assessment.reasons.map((reason, i) => (
                <Text key={i}>
                  • {reason[meta.locale === "sw" ? "sw" : "en"]}
                </Text>
              ))}
            </>
          ) : (
            <Text>{labels.assessmentUnavailable}</Text>
          )}
        </View>

        <Text style={styles.footer} fixed>
          {labels.footer}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderSummaryPdf(
  data: SummaryData,
  meta: SummaryPdfMeta,
): Promise<Buffer> {
  return renderToBuffer(<SummaryDocument data={data} meta={meta} />);
}
