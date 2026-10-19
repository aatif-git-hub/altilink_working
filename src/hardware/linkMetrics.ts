import { Position, FRESH_MS } from './protocol';
import { calculateHaversineDistance } from '../utils/haversine';
export type Sample = { seq: number; time: number; rssi: number; snr: number; distance: number | null };
export type LinkStats = { samples: number; delivery: number | null; rssi: number | null; snr: number | null; boundary: number | null; limit: number | null; stale: boolean };
export function distanceBetween(a: Position, b: Position) {
  return calculateHaversineDistance({ latitude: a.lat, longitude: a.lon }, { latitude: b.lat, longitude: b.lon });
}
export function assessLink(samples: Sample[], now: number, margin: number): LinkStats {
  const recent = samples.filter(s => now - s.time <= 120000);
  const stale = !recent.length || now - recent[recent.length - 1].time > FRESH_MS;
  const empty: LinkStats = { samples: recent.length, delivery: null, rssi: null, snr: null, boundary: null, limit: null, stale };
  if (!recent.length) return empty;
  const first = recent[0], last = recent[recent.length - 1];
  const expected = last.seq - first.seq + 1;
  const delivery = expected > 0 ? Math.min(100, recent.length / expected * 100) : null;
  const rssi = recent.reduce((s, x) => s + x.rssi, 0) / recent.length;
  const snr = recent.reduce((s, x) => s + x.snr, 0) / recent.length;
  const located = recent.filter(s => s.distance !== null);
  const distances = located.map(s => s.distance!);
  const spread = distances.length ? Math.max(...distances) - Math.min(...distances) : Infinity;
  const stationary = distances.length > 0 && spread <= Math.max(25, Math.max(...distances) * 0.1);
  const qualified = !stale && recent.length >= 10 && located.length === recent.length && stationary && delivery !== null && delivery >= 90 && rssi >= -90 && snr >= 0;
  const boundary = qualified ? Math.min(...distances) : null;
  return { samples: recent.length, delivery, rssi, snr, stale, boundary, limit: boundary === null ? null : Math.floor(boundary * (1 - Math.min(50, Math.max(10, margin)) / 100)) };
}
