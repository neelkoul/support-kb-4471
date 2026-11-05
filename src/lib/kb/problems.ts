// The problems #4471 really holds, counted the desk's way. causes.ts places every report by tenant and
// channel (parser or hint), as CauseTable does. The desk's own notes (desk-notes.json, oneDayMove)
// mark reports whose body describes a one-day move, not a day-month swap: their own problem. Like
// CauseTable's footnote, they stay counted where they are filed and are counted again as one-day.
import { causeOf, uniqueById, type Report, type Tenant } from '#lib/kb/causes';

export type Problem = 'parser' | 'hint' | 'one-day' | 'unplaced';

export const PROBLEMS: Record<Exclude<Problem, 'unplaced'>, { title: string; issue: number }> = {
  parser: { title: 'Shared date parser reads day-first dates month-first', issue: 1 },
  hint: { title: 'booking-v3 form prints an MM/DD hint but reads the date day-first', issue: 2 },
  'one-day': { title: 'Bookings land one day off across time zones', issue: 3 },
};

export function problemOf(r: Report, t: Tenant | undefined): Problem {
  return causeOf(r, t) ?? 'unplaced';
}

export type ProblemRow = { problem: Problem; reports: Report[]; tenants: number; firstSeen: string; lastSeen: string };

export function splitTicket(
  all: Report[],
  ticket: number,
  tenantOf: (r: Report) => Tenant | undefined,
  oneDayMove: readonly string[],
): { rows: number; unique: Report[]; groups: ProblemRow[] } {
  const unique = uniqueById(all).filter((r) => r.mergedInto === ticket);
  const by = new Map<Problem, Report[]>();
  for (const r of unique) {
    const p = problemOf(r, tenantOf(r));
    by.set(p, [...(by.get(p) ?? []), r]);
  }
  const moved = unique.filter((r) => oneDayMove.includes(r.id));
  if (moved.length) by.set('one-day', moved);
  const groups = [...by.entries()]
    .map(([problem, rs]) => {
      const days = rs.map((r) => r.receivedAt.slice(0, 10)).sort();
      return { problem, reports: rs, tenants: new Set(rs.map((r) => r.tenant)).size, firstSeen: days[0], lastSeen: days[days.length - 1] };
    })
    .sort((a, b) => b.reports.length - a.reports.length);
  return { rows: all.filter((r) => r.mergedInto === ticket).length, unique, groups };
}
