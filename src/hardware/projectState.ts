import { EmergencyPacket, GroupProfile, LinkAssessmentResult, Member, UserProfile } from '../types';
import { FRESH_MS } from './protocol';
import { assessLink, distanceBetween } from './linkMetrics';
import type { useBand } from './useBand';
export type BandState = ReturnType<typeof useBand>;
export function projectHardware(b: BandState, group: GroupProfile | null, user: UserProfile | null, margin: number, closed: string[]) {
  const matches = !!group && !!user && b.hello?.group === group.code && b.hello?.node === user.memberId;
  const connected = matches && b.connection === 'connected';
  const ready = connected && !!b.hello?.radio;
  const localFix = connected && !!b.local.position && b.now - b.local.at <= FRESH_MS;
  const peers = matches ? Object.values(b.peers) : [];
  const stats = peers.map(p => ({ id: p.id, ...assessLink(p.samples, b.now, margin) }));
  const qualified = stats.length > 0 && stats.every(s => s.limit !== null) && ready && localFix;
  const limit = qualified ? Math.min(...stats.map(s => s.limit!)) : NaN;
  const members: Member[] = user ? [{
    id: user.memberId, name: user.name, latitude: localFix ? b.local.position!.lat : NaN,
    longitude: localFix ? b.local.position!.lon : NaN, gpsValid: localFix, distance: localFix ? 0 : NaN,
    isCurrentUser: true, isLeader: user.isLeader, connectionStatus: connected ? 'Connected' : 'Disconnected',
    emergencyStatus: qualified ? 'Safe' : 'Warning', lastSeen: localFix ? 'Just now' : 'GPS unavailable'
  }] : [];
  for (const p of peers) {
    const fresh = connected && b.now - p.seen <= FRESH_MS;
    const gpsValid = fresh && !!p.position && b.now - p.positionAt <= FRESH_MS;
    const distance = localFix && gpsValid ? distanceBetween(b.local.position!, p.position!) : NaN;
    members.push({ id:p.id, name:p.id, latitude:gpsValid ? p.position!.lat : NaN,
      longitude:gpsValid ? p.position!.lon : NaN, gpsValid, distance, isLeader:group?.leaderId === p.id,
      isCurrentUser:false, connectionStatus:!fresh ? 'Disconnected' : distance > limit ? 'Warning' : 'Connected',
      emergencyStatus:!fresh || !gpsValid || !qualified || distance > limit ? 'Warning' : 'Safe', rssi:p.rssi, snr:p.snr,
      lastSeen:`${Math.max(0,Math.floor((b.now-p.seen)/1000))}s ago` });
  }
  const alert = matches ? b.alerts.find(a => !closed.includes(a.id)) : undefined;
  const outgoing = matches && b.outgoing && !closed.includes(b.outgoing.id) ? b.outgoing : null;
  let emergency: EmergencyPacket | null = null;
  if (alert) emergency = { packetID:alert.id, groupID:group!.code, senderID:alert.from, senderName:alert.from,
    messageType:'MANUAL_SOS', latitude:alert.position?.lat ?? NaN, longitude:alert.position?.lon ?? NaN,
    gpsValid:!!alert.position, altitude:NaN, timestamp:new Date(alert.time).toLocaleTimeString(), status:'RECEIVED' };
  else if (outgoing) emergency = { packetID:outgoing.id, groupID:group!.code, senderID:user!.memberId, senderName:user!.name,
    messageType:'MANUAL_SOS', latitude:outgoing.position?.lat ?? NaN, longitude:outgoing.position?.lon ?? NaN,
    gpsValid:!!outgoing.position, altitude:NaN, timestamp:new Date(outgoing.time).toLocaleTimeString(), status:b.outgoingReceipts.length ? 'RECEIVED' : 'PENDING' };
  for (const m of members) if (m.id === emergency?.senderID) m.emergencyStatus = 'Emergency';
  const average = (values: (number | null)[]) => {
    const available = values.filter((x): x is number => x !== null && Number.isFinite(x));
    return available.length ? available.reduce((sum, x) => sum + x, 0) / available.length : NaN;
  };
  const link: LinkAssessmentResult = { lastEvaluatedAt:new Date(b.now).toLocaleTimeString(),terrain:'DENSE_FOREST',
    reliableBoundary:qualified ? Math.min(...stats.map(s => s.boundary!)) : NaN, safetyMarginPercent:margin,
    recommendedGroupLimit:limit, overallQuality:qualified ? 'GOOD' : 'UNKNOWN',
    avgRssi:average(stats.map(s => s.rssi)),
    avgSnr:average(stats.map(s => s.snr)),
    avgPacketSuccess:average(stats.map(s => s.delivery)), measurements:[] };
  return { matches, connected, ready, localFix, members, stats, limit, emergency, link,
    overall: emergency ? 'EMERGENCY' as const : !qualified || members.some(m => m.connectionStatus !== 'Connected') ? 'WARNING' as const : 'SAFE' as const };
}
