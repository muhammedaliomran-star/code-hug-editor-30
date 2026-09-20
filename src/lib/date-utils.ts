export function isoToDDMMYYYY(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function ddmmyyyyToIso(s: string): string | null {
  if (!s) return null;
  const parts = s.split(/[/.-]/);
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  const d = Number(dd);
  const m = Number(mm);
  const y = Number(yyyy);
  if (!d || !m || !y) return null;
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}
