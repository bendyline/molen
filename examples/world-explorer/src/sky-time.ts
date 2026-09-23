/** Browser-local calendar controls; the renderer receives only the resulting UTC instant. */
export function localSkyDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 24:00 is the following midnight. Local DST transitions follow the browser's calendar. */
export function localSkyTime(date: string, minutes: number): number | undefined {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isInteger(minutes) ||
    minutes < 0 ||
    minutes > 1440
  )
    return undefined;
  const midnight = new Date(`${date}T00:00:00`);
  if (localSkyDate(midnight) !== date || date < '1901-01-01' || date > '2099-12-31')
    return undefined;
  midnight.setHours(0, minutes, 0, 0);
  return midnight.getTime();
}
