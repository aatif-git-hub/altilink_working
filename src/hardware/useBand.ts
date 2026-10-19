import { useEffect, useMemo, useRef, useState } from 'react';
import { BandClient } from './bandClient';
import { communicationService } from '../services/communicationService';
import { BoardEvent, FRESH_MS, Position, packetId } from './protocol';
import { distanceBetween, Sample } from './linkMetrics';
export type Peer = { id: string; boot: string; position: Position | null; seen: number; positionAt: number; rssi: number; snr: number; samples: Sample[]; lastPositionSeq: number };
export type Alert = { id: string; from: string; position: Position | null; time: number; acknowledged: boolean };
export function useBand() {
  const [connection, setConnection] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [name, setName] = useState('');
  const [hello, setHello] = useState<Extract<BoardEvent, { event: 'hello' }> | null>(null);
  const helloRef = useRef<typeof hello>(null);
  const [local, setLocal] = useState<{ position: Position | null; at: number }>({ position: null, at: 0 });
  const localRef = useRef(local);
  const [peers, setPeers] = useState<Record<string, Peer>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [receipts, setReceipts] = useState<{ ref: string; from: string; time: number }[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [outgoing, setOutgoing] = useState<{ id: string; time: number; position: Position | null } | null>(null);
  const [now, setNow] = useState(Date.now());
  const seen = useRef(new Set<string>());
  const clientRef = useRef<BandClient | null>(null);
  const addLog = (message: string) => setLog(x => [`${new Date().toLocaleTimeString()} ${message}`, ...x].slice(0, 100));
  const clearMeasurements = () => {
    setPeers({}); seen.current.clear(); setAlerts([]); setReceipts([]); setOutgoing(null);
    localRef.current = { position: null, at: 0 }; setLocal(localRef.current);
  };
  const receive = (e: BoardEvent) => {
    const now = Date.now();
    if (e.event === 'hello') {
      const old = helloRef.current;
      if (!old || old.group !== e.group || old.node !== e.node || old.boot !== e.boot) clearMeasurements();
      helloRef.current = e; setHello(e);
      addLog(`Band ${e.node} · group ${e.group} · radio ${e.radio ? 'ready' : 'failed'}`);
    } else if (e.event === 'local') {
      const value = { position: e.fix ? { lat: e.lat!, lon: e.lon! } : null, at: now };
      localRef.current = value; setLocal(value);
    } else if (e.event === 'rx') {
      const p = e.packet, board = helloRef.current;
      if (!board || p.group !== board.group || p.from === board.node) return;
      const id = packetId(p);
      if (seen.current.has(id)) return;
      seen.current.add(id);
      if (seen.current.size > 1024) seen.current.delete(seen.current.values().next().value!);
      const pos = p.fix ? { lat: p.lat!, lon: p.lon! } : null;
      const local = localRef.current;
      const distance = pos && local.position && now - local.at <= FRESH_MS ? distanceBetween(local.position, pos) : null;
      setPeers(previous => {
        const old = previous[p.from];
        const sameBoot = old?.boot === p.boot;
        const samples = sameBoot && now - old.seen <= FRESH_MS ? old.samples : [];
        const acceptPosition = p.type === 'position' && (!sameBoot || p.ps! > old.lastPositionSeq);
        const sample: Sample = { seq: p.ps!, time: now, rssi: e.rssi, snr: e.snr, distance };
        const next: Peer = { id: p.from, boot: p.boot, position: acceptPosition ? pos : (sameBoot ? old.position : pos),
          positionAt: acceptPosition ? now : (sameBoot ? old.positionAt : now), seen: now, rssi: e.rssi, snr: e.snr,
          samples: acceptPosition ? [...samples, sample].filter(x => now - x.time <= 120000).slice(-60) : samples,
          lastPositionSeq: acceptPosition ? p.ps! : (sameBoot ? old.lastPositionSeq : -1) };
        const entries = Object.entries({ ...previous, [p.from]: next }).sort((a, b) => b[1].seen - a[1].seen).slice(0, 64);
        return Object.fromEntries(entries);
      });
      if (p.type === 'sos') {
        setAlerts(x => [{ id, from: p.from, position: pos, time: now, acknowledged: false }, ...x].slice(0, 50));
        addLog(`SOS received from ${p.from}${pos ? '' : ' without GPS fix'}`);
      } else if (p.type === 'ack' && p.to === board.node) {
        setReceipts(x => [{ ref: p.ref!, from: p.from, time: now }, ...x].slice(0, 100));
        addLog(`Peer ${p.from} acknowledged ${p.ref}`);
      }
    } else if (e.event === 'result') {
      addLog(e.message);
      if (e.id === 'button' && e.ok && e.packetId) setOutgoing({ id: e.packetId, time: now, position:e.fix ? {lat:e.lat!,lon:e.lon!} : null });
    }
  };
  const receiveRef = useRef(receive); receiveRef.current = receive;
  useEffect(() => {
    const client = communicationService.createBandClient(e => receiveRef.current(e), () => {
      setConnection('disconnected');
      setError('Bluetooth disconnected. Reconnect to receive new packets.');
    }, message => addLog(`Rejected input: ${message}`));
    clientRef.current = client;
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(clock); void client.disconnect(); clientRef.current = null; };
  }, []);
  const connect = async () => {
    if (connection !== 'disconnected') return;
    setError(''); setConnection('connecting'); clearMeasurements(); helloRef.current = null; setHello(null);
    try {
      setName(await clientRef.current!.connect());
      await clientRef.current!.command('status');
      if (!helloRef.current) throw Error('No compatible AltiLink handshake. Flash the included firmware.');
      setConnection('connected');
    } catch (e) {
      await clientRef.current?.disconnect(); setConnection('disconnected');
      setError((e as Error).message);
    }
  };
  const disconnect = async () => {
    await clientRef.current?.disconnect(); setConnection('disconnected');
  };
  const perform = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const configure = (group: string, node: string) => perform(async () => {
    if (!/^[A-Z0-9_-]{1,20}$/.test(group) || !/^[A-Z0-9_-]{1,20}$/.test(node)) throw Error('Use 1–20 uppercase letters, numbers, hyphens or underscores for group and member ID.');
    await clientRef.current!.command('configure', { group, node });
  });
  const sendSOS = () => perform(async () => {
    const result = await clientRef.current!.command('sos');
    if (!result.packetId) throw Error('Board did not return a transmission ID');
    setOutgoing({ id: result.packetId, time: Date.now(), position:result.fix ? {lat:result.lat!,lon:result.lon!} : null });
  });
  const acknowledge = (a: Alert) => perform(async () => {
    await clientRef.current!.command('ack', { ref: a.id, to: a.from });
    setAlerts(x => x.map(item => item.id === a.id ? { ...item, acknowledged: true } : item));
  });
  const outgoingReceipts = useMemo(() => receipts.filter(r => r.ref === outgoing?.id), [receipts, outgoing]);
  return { connection, name, hello, local, peers, alerts, log, error, busy, now, outgoing, outgoingReceipts,
    connect, disconnect, configure, sendSOS, acknowledge,
    refresh: () => perform(async () => { await clientRef.current!.command('status'); }) };
}
