// Set once when the user requested 30 days, never recalculated on a visit.
export const OFFER = Object.freeze({
  startedAt: '2026-10-03T17:01:37Z',
  deadline: '2026-11-02T17:01:37Z',
  expiryAction: 'close',
});

export function remaining(deadline, now = Date.now()) {
  const end = Date.parse(deadline);
  if (!Number.isFinite(end) || !Number.isFinite(now)) return null;
  const seconds = Math.max(0, Math.ceil((end - now) / 1000));
  return { expired: now >= end, days: Math.floor(seconds / 86400), hours: Math.floor(seconds / 3600) % 24, minutes: Math.floor(seconds / 60) % 60, seconds: seconds % 60 };
}
