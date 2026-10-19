import { describe, it, expect, vi, afterEach } from 'vitest';
import { LineDecoder, parseEvent } from '../hardware/protocol';
import { assessLink, Sample } from '../hardware/linkMetrics';
import { BandClient } from '../hardware/bandClient';
import type { BandTransport } from '../hardware/bleTransport';
const bytes = (s: string) => new DataView(new TextEncoder().encode(s).buffer);
const position = { v: 1, event: 'rx', rssi: -78, snr: 5, packet: { v: 1, type: 'position', group: 'ALT-TEST', from: 'M02', boot: 'abc', seq: 10, ps: 8, fix: true, lat: 0, lon: 0 } };
describe('Hardware packet framing and validation', () => {
  it('assembles fragmented and coalesced notifications, including split UTF-8', () => {
    const d = new LineDecoder();
    const input = new TextEncoder().encode('héllo\nworld\n');
    expect(d.push(new DataView(input.slice(0,2).buffer))).toEqual([]);
    expect(d.push(new DataView(input.slice(2).buffer))).toEqual(['héllo', 'world']);
  });
  it('drops oversize frames and recovers at the next newline', () => {
    const d = new LineDecoder();
    expect(d.push(bytes('x'.repeat(1200) + '\nok\n'))).toEqual(['ok']);
  });
  it('accepts equator/Greenwich positions and rejects invalid numeric fields', () => {
    expect(parseEvent(JSON.stringify(position)).event).toBe('rx');
    expect(() => parseEvent(JSON.stringify({ ...position, packet: { ...position.packet, lat: 91 } }))).toThrow();
    expect(() => parseEvent(JSON.stringify({ ...position, packet: { ...position.packet, seq: -1 } }))).toThrow();
    expect(() => parseEvent(JSON.stringify({ ...position, packet: { ...position.packet, ps: undefined } }))).toThrow();
    expect(() => parseEvent(JSON.stringify({ ...position, rssi: 'strong' }))).toThrow();
  });
  it('permits a real no-fix SOS without inventing coordinates', () => {
    expect(parseEvent(JSON.stringify({ ...position, packet: { ...position.packet, type: 'sos', fix: false, lat: undefined, lon: undefined } })).event).toBe('rx');
  });
  it('rejects bad protocol, unsafe identifiers, and uncorrelated ACKs', () => {
    for (const p of [{ ...position, v: 2 }, { ...position, packet: { ...position.packet, from: '<img>' } }, { ...position, packet: { ...position.packet, type: 'ack' } }]) expect(() => parseEvent(JSON.stringify(p))).toThrow();
  });
});
const now = 200000;
const samples = (count = 10): Sample[] => Array.from({ length: count }, (_, i) => ({ time: now - (count - 1 - i) * 5000, seq: i + 1, rssi: -78, snr: 5, distance: 100 }));
describe('Measured range evidence', () => {
  it('does not invent a range from one packet or missing GPS', () => {
    expect(assessLink(samples(1), now, 20).limit).toBeNull();
    expect(assessLink(samples().map(s => ({ ...s, distance: null })), now, 20).limit).toBeNull();
  });
  it('applies a margin only to qualified fresh samples', () => {
    expect(assessLink(samples(), now, 20)).toMatchObject({ boundary: 100, limit: 80, delivery: 100, stale: false });
    expect(assessLink(samples(), now + 46000, 20)).toMatchObject({ limit: null, stale: true });
  });
  it('counts sequence gaps and rejects unreliable or moving measurement windows', () => {
    const lossy = samples().map((s,i) => ({ ...s, seq: i * 2 + 1 }));
    expect(assessLink(lossy, now, 20).delivery).toBeCloseTo(10 / 19 * 100);
    expect(assessLink(lossy, now, 20).limit).toBeNull();
    expect(assessLink(samples().map((s,i) => ({ ...s, distance: i * 40 })), now, 20).limit).toBeNull();
    expect(assessLink(samples().map(s => ({ ...s, rssi: -110 })), now, 20).limit).toBeNull();
  });
});
class FakeTransport implements BandTransport {
  data!: (value: DataView) => void;
  lost!: () => void;
  lastCommand: any;
  async connect(data: (value: DataView) => void, lost: () => void) { this.data = data; this.lost = lost; return 'Test band'; }
  async write(value: Uint8Array) { this.lastCommand = JSON.parse(new TextDecoder().decode(value)); }
  async disconnect() {}
  reply(ok = true) { this.data(bytes(JSON.stringify({ v:1, event:'result', id:this.lastCommand.id, ok, message:ok ? 'transmitted' : 'radio failed' }) + '\n')); }
}
afterEach(() => vi.useRealTimers());
describe('Command result handling', () => {
  it('waits for board confirmation instead of treating BLE write as delivery', async () => {
    const t = new FakeTransport(); const c = new BandClient(t, () => {}, () => {}, () => {}); await c.connect();
    let complete = false; const request = c.command('sos').then(() => { complete = true; });
    await Promise.resolve(); expect(complete).toBe(false);
    t.reply(); await request; expect(complete).toBe(true); await c.disconnect();
  });
  it('rejects board errors and unknown outcomes on disconnection', async () => {
    const t = new FakeTransport(); const c = new BandClient(t, () => {}, () => {}, () => {}); await c.connect();
    const a = c.command('sos'); t.reply(false); await expect(a).rejects.toThrow('radio failed');
    const b = c.command('sos'); t.lost(); await expect(b).rejects.toThrow('unknown');
  });
  it('times out without fabricating a recipient acknowledgement', async () => {
    vi.useFakeTimers();
    const t = new FakeTransport(); const c = new BandClient(t, () => {}, () => {}, () => {}); await c.connect();
    const request = c.command('sos'); const check = expect(request).rejects.toThrow('Delivery is unknown');
    await vi.advanceTimersByTimeAsync(15001); await check;
  });
});
