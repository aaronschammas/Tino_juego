export function secondsToHMS(totalSeconds: number): string {
  const roundedSeconds = Math.round(totalSeconds);
  if (!Number.isFinite(roundedSeconds) || roundedSeconds <= 0) return '00:00:00';

  const hrs = Math.floor(roundedSeconds / 3600);
  const mins = Math.floor((roundedSeconds % 3600) / 60);
  const secs = roundedSeconds % 60;

  return `${hrs.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function normalizeDurationParts(
  hoursInput: string,
  minutesInput: string,
): { hours: string; minutes: string } {
  const hours = parseInt(hoursInput, 10);
  const minutes = parseInt(minutesInput, 10);
  const safeHours = Number.isFinite(hours) ? hours : 0;
  const safeMinutes = Number.isFinite(minutes) ? minutes : 0;
  const totalMinutes = Math.max(safeHours * 60 + safeMinutes, 0);

  return {
    hours: Math.floor(totalMinutes / 60).toString(),
    minutes: (totalMinutes % 60).toString(),
  };
}

export function formatDateUTC(
  dateString: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('es-AR', {
    ...options,
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}