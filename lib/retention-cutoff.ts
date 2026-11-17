/**
 * Date before which a record is past its retention period. Calendar months, so "24 months" on
 * 2026-11-17 is 2024-11-17. Months that are too short clamp to their last day (31 Mar - 1 month = 28/29 Feb).
 */
export function retentionCutoff(now: Date, months: number): Date {
  const cutoff = new Date(now.getTime());
  const day = cutoff.getUTCDate();
  cutoff.setUTCDate(1);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate();
  cutoff.setUTCDate(Math.min(day, lastDay));
  return cutoff;
}
