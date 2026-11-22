export type ScoreRow = {
  name: string;
  peak: number;
  peakAt: string;
  cashout: number;
  cashoutAt: string;
};

const KEY = "bc-scores";

function nameKey(name: string): string {
  return name.trim().toLowerCase() || "player";
}

function save(rows: ScoreRow[]): void {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

export function loadScores(): ScoreRow[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const rows = JSON.parse(raw) as ScoreRow[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** First time a name is seen, the peak is stored quietly. A later higher peak is a new high score. */
export function recordPeak(name: string, amount: number): { rows: ScoreRow[]; isNew: boolean } {
  const rows = loadScores();
  const now = new Date().toLocaleString();
  let row = rows.find((r) => nameKey(r.name) === nameKey(name));
  if (!row) {
    rows.push({ name: name.trim() || "Player", peak: amount, peakAt: now, cashout: 0, cashoutAt: "" });
    save(rows);
    return { rows, isNew: false };
  }
  if (amount > row.peak + 0.001) {
    row.peak = amount;
    row.peakAt = now;
    row.name = name.trim() || row.name;
    save(rows);
    return { rows, isNew: true };
  }
  return { rows, isNew: false };
}

export function recordCashout(name: string, amount: number): ScoreRow[] {
  const rows = loadScores();
  const now = new Date().toLocaleString();
  let row = rows.find((r) => nameKey(r.name) === nameKey(name));
  if (!row) {
    row = { name: name.trim() || "Player", peak: amount, peakAt: now, cashout: amount, cashoutAt: now };
    rows.push(row);
  } else if (amount > row.cashout + 0.001) {
    row.cashout = amount;
    row.cashoutAt = now;
    row.name = name.trim() || row.name;
  }
  save(rows);
  return rows;
}

export function rankedScores(): ScoreRow[] {
  return loadScores().slice().sort((a, b) => b.peak - a.peak || b.cashout - a.cashout);
}
