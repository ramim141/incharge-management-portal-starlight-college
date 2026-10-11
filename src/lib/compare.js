// Class-by-class comparison for the principal, from the stats each class keeps up to date on its own record.

const n = (v) => Number(v || 0);

/** Rows for the comparison screen. A class that has not reported yet (no stats) gets nulls, not zeros. */
export function compareClasses(classes) {
  return classes.map((c) => {
    const s = c.stats;
    if (!s) return { id: c.id, name: c.name, section: c.section || '', students: 0, reported: false, pct: null, collected: 0, monthDue: 0, totalDue: 0, attPct: null, attendanceTaken: false, absent: 0, overdue: 0, pendingLeaves: 0, todayCash: 0 };
    const target = n(s.collected) + n(s.monthDue);
    return {
      id: c.id,
      name: c.name,
      section: c.section || '',
      students: n(s.students),
      reported: true,
      pct: target > 0 ? Math.round((n(s.collected) / target) * 100) : null,
      collected: n(s.collected),
      monthDue: n(s.monthDue),
      totalDue: n(s.totalDue),
      // today's attendance: only meaningful once the class has taken it
      attPct: s.attendanceTaken && n(s.students) > 0 ? Math.round((n(s.present) / n(s.students)) * 100) : null,
      attendanceTaken: !!s.attendanceTaken,
      absent: n(s.absent),
      overdue: n(s.overdue),
      pendingLeaves: n(s.pendingLeaves),
      todayCash: n(s.todayCash),
    };
  });
}

export const COMPARE_KEYS = {
  pct: { bn: 'আদায়', value: (r) => r.pct, higherIsBetter: true },
  due: { bn: 'বকেয়া', value: (r) => (r.reported ? r.totalDue : null), higherIsBetter: false },
  att: { bn: 'আজকের হাজিরা', value: (r) => r.attPct, higherIsBetter: true },
};

/** Best first for the chosen measure; classes with no figure yet go last, in name order */
export function sortBy(rows, key) {
  const k = COMPARE_KEYS[key];
  return [...rows].sort((a, b) => {
    const x = k.value(a);
    const y = k.value(b);
    if (x === null && y === null) return String(a.name).localeCompare(String(b.name));
    if (x === null) return 1;
    if (y === null) return -1;
    return (k.higherIsBetter ? y - x : x - y) || String(a.name).localeCompare(String(b.name));
  });
}

/** Traffic-light for a percentage: green 80+, amber 50–79, red below */
export const tone = (pct) => (pct === null ? 'none' : pct >= 80 ? 'good' : pct >= 50 ? 'mid' : 'low');

/** All classes together */
export function totals(rows) {
  const r = rows.filter((x) => x.reported);
  const collected = r.reduce((a, x) => a + x.collected, 0);
  const monthDue = r.reduce((a, x) => a + x.monthDue, 0);
  const taken = r.filter((x) => x.attendanceTaken);
  const students = r.reduce((a, x) => a + x.students, 0);
  const takenStudents = taken.reduce((a, x) => a + x.students, 0);
  return {
    classes: rows.length,
    reported: r.length,
    students,
    collected,
    monthDue,
    totalDue: r.reduce((a, x) => a + x.totalDue, 0),
    pct: collected + monthDue > 0 ? Math.round((collected / (collected + monthDue)) * 100) : null,
    // weighted by class size, over the classes that have taken attendance today
    attPct: takenStudents > 0 ? Math.round((taken.reduce((a, x) => a + (x.attPct / 100) * x.students, 0) / takenStudents) * 100) : null,
    attendanceMissing: r.filter((x) => !x.attendanceTaken).length,
    pendingLeaves: r.reduce((a, x) => a + x.pendingLeaves, 0),
    todayCash: r.reduce((a, x) => a + x.todayCash, 0),
  };
}
