const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function startOfWeek(date: Date, weekStartsOn: 0 | 1 = 1): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfWeek(date: Date, weekStartsOn: 0 | 1 = 1): Date {
  const s = startOfWeek(date, weekStartsOn);
  return new Date(s.getTime() + 7 * MS_PER_DAY - 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatDateISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}
