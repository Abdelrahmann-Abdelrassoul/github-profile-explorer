import type { Metric } from "@/lib/compare";
import { shares } from "@/lib/compare";

/**
 * One bar per metric, split proportionally between the two users in their identity
 * colours.
 *
 * Follows the same accessibility shape as LanguageBar: the bar itself is role="img" with
 * a text alternative, and the numbers are real text alongside it rather than being
 * encoded only in bar widths.
 */
export function MetricComparison({
  metrics,
  aLogin,
  bLogin,
  aColor,
  bColor,
}: {
  metrics: Metric[];
  aLogin: string;
  bLogin: string;
  aColor: string;
  bColor: string;
}) {
  return (
    <section aria-labelledby="metrics-heading" className="space-y-5">
      <h2
        id="metrics-heading"
        className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Metrics
      </h2>

      <ul className="space-y-5">
        {metrics.map((metric) => {
          const { aShare, bShare, comparable } = shares(metric.aValue, metric.bValue);

          return (
            <li key={metric.label} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-sm tabular-nums" style={{ color: aColor }}>
                  {metric.aDisplay}
                </span>

                <span className="min-w-0 text-center text-xs text-muted-foreground">
                  {metric.label}
                  {metric.note && (
                    <span className="block text-[0.65rem] opacity-80">{metric.note}</span>
                  )}
                </span>

                <span className="font-mono text-sm tabular-nums" style={{ color: bColor }}>
                  {metric.bDisplay}
                </span>
              </div>

              {comparable ? (
                <div
                  role="img"
                  aria-label={`${metric.label}: ${aLogin} ${metric.aDisplay}, ${bLogin} ${metric.bDisplay}`}
                  className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div style={{ width: `${aShare * 100}%`, backgroundColor: aColor }} />
                  <div style={{ width: `${bShare * 100}%`, backgroundColor: bColor }} />
                </div>
              ) : (
                <div
                  className="h-1.5 w-full rounded-full bg-muted"
                  aria-label={`${metric.label}: not comparable`}
                  role="img"
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
