export const SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const WRITE = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
export const NOTIFY = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
export const MAX_LINE = 1024;
export const FRESH_MS = 45000;
export type Position = { lat: number; lon: number };
export type RadioPacket = {
  v: 1; type: 'position' | 'sos' | 'ack'; group: string; from: string;
  boot: string; seq: number; fix: boolean; lat?: number; lon?: number;
  ref?: string; to?: string; ps?: number;
};
export type BoardEvent =
  | { v: 1; event: 'hello'; group: string; node: string; radio: boolean; boot: string }
  | { v: 1; event: 'local'; fix: boolean; lat?: number; lon?: number }
  | { v: 1; event: 'rx'; packet: RadioPacket; rssi: number; snr: number }
  | { v: 1; event: 'result'; id: string; ok: boolean; message: string; packetId?: string; fix?: boolean; lat?: number; lon?: number };
const ident = (x: unknown): x is string => typeof x === 'string' && /^[A-Za-z0-9_-]{1,20}$/.test(x);
export const validPosition = (x: { lat?: unknown; lon?: unknown }): x is Position =>
  typeof x.lat === 'number' && Number.isFinite(x.lat) && Math.abs(x.lat) <= 90 &&
  typeof x.lon === 'number' && Number.isFinite(x.lon) && Math.abs(x.lon) <= 180;
export const packetId = (p: RadioPacket) => `${p.from}:${p.boot}:${p.seq}`;
export function parseEvent(line: string): BoardEvent {
  if (new TextEncoder().encode(line).length > MAX_LINE) throw Error('Packet too large');
  const x = JSON.parse(line);
  if (!x || x.v !== 1) throw Error('Unsupported protocol');
  if (x.event === 'hello' && ident(x.group) && ident(x.node) && ident(x.boot) && typeof x.radio === 'boolean') return x;
  if (x.event === 'local' && typeof x.fix === 'boolean' && (!x.fix || validPosition(x))) return x;
  if (x.event === 'result' && ident(x.id) && typeof x.ok === 'boolean' && typeof x.message === 'string' && x.message.length <= 200 && (x.fix === undefined || (typeof x.fix === 'boolean' && (!x.fix || validPosition(x)))) && (x.packetId === undefined || (typeof x.packetId === 'string' && x.packetId.length <= 64))) return x;
  if (x.event === 'rx') {
    const p = x.packet;
    if (p && p.v === 1 && ['position', 'sos', 'ack'].includes(p.type) &&
      ident(p.group) && ident(p.from) && ident(p.boot) && Number.isSafeInteger(p.seq) && p.seq >= 0 && p.seq <= 4294967295 &&
      (p.type !== 'position' || (Number.isSafeInteger(p.ps) && p.ps >= 0 && p.ps <= 4294967295)) &&
      typeof p.fix === 'boolean' && (!p.fix || validPosition(p)) &&
      Number.isFinite(x.rssi) && x.rssi >= -160 && x.rssi <= 10 && Number.isFinite(x.snr) && Math.abs(x.snr) <= 50 &&
      (p.type !== 'ack' || (ident(p.to) && typeof p.ref === 'string' && /^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:\d+$/.test(p.ref) && p.ref.length <= 64))) return x;
  }
  throw Error('Malformed board event');
}
export class LineDecoder {
  private text = '';
  private decoder = new TextDecoder('utf-8', { fatal: true });
  private discarding = false;
  reset() { this.text = ''; this.decoder = new TextDecoder('utf-8', { fatal: true }); this.discarding = false; }
  push(value: DataView): string[] {
    let chunk: string;
    try { chunk = this.decoder.decode(value, { stream: true }); }
    catch { this.reset(); throw Error('Invalid UTF-8 from board'); }
    const lines: string[] = [];
    for (const char of chunk) {
      if (char === '\n') {
        if (!this.discarding && this.text.trim()) lines.push(this.text.trim());
        this.text = ''; this.discarding = false;
      } else if (!this.discarding) {
        this.text += char;
        if (this.text.length > MAX_LINE) { this.text = ''; this.discarding = true; }
      }
    }
    return lines;
  }
}
