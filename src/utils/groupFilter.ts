import { EmergencyPacket, ForeignPacketTest } from '../types';

/**
 * Group ID Private Emergency Filtering Engine
 *
 * Prevents alert fatigue and crosstalk in crowded hiking areas.
 * Packets from different trekking teams are filtered out at the MAC / Protocol layer.
 */

export interface FilterResult {
  accepted: boolean;
  status: 'ACCEPTED' | 'IGNORED — FOREIGN GROUP';
  reason: string;
  packetDetails: {
    currentGroupID: string;
    incomingGroupID: string;
    senderID: string;
    timestamp: string;
  };
}

export function filterGroupPacket(
  packet: Partial<EmergencyPacket> & { groupID: string; senderID: string },
  currentGroupID: string
): FilterResult {
  const isMatch = packet.groupID.trim().toUpperCase() === currentGroupID.trim().toUpperCase();

  if (isMatch) {
    return {
      accepted: true,
      status: 'ACCEPTED',
      reason: `Packet group ID [${packet.groupID}] matches local group ID [${currentGroupID}]. Dispatching emergency handler.`,
      packetDetails: {
        currentGroupID,
        incomingGroupID: packet.groupID,
        senderID: packet.senderID,
        timestamp: packet.timestamp || new Date().toISOString(),
      },
    };
  } else {
    return {
      accepted: false,
      status: 'IGNORED — FOREIGN GROUP',
      reason: `REJECTED: Packet group ID [${packet.groupID}] does not match local group ID [${currentGroupID}]. Packet discarded.`,
      packetDetails: {
        currentGroupID,
        incomingGroupID: packet.groupID,
        senderID: packet.senderID,
        timestamp: packet.timestamp || new Date().toISOString(),
      },
    };
  }
}

/**
 * Generates structured simulated test packet
 */
export function createSimulatedPacket(
  groupID: string,
  senderID: string,
  messageType: 'SOS' | 'FALL_DETECTED' | 'MANUAL_SOS' = 'SOS',
  coords: { latitude: number; longitude: number } = { latitude: 13.0827, longitude: 80.2707 }
): EmergencyPacket {
  const seq = Math.floor(100 + Math.random() * 900);
  return {
    packetID: `PKT-${seq}`,
    groupID,
    senderID,
    senderName: senderID === 'M03' ? 'Rahul' : senderID === 'M04' ? 'Karthik' : 'Foreign Member',
    messageType,
    latitude: coords.latitude,
    longitude: coords.longitude,
    altitude: 412,
    timestamp: new Date().toLocaleTimeString(),
    rawPayloadHex: `0xAA55${groupID === 'TREK-01' ? '01' : '99'}${senderID === 'M03' ? '03' : '04'}FF`,
    status: 'PENDING',
  };
}

export function testForeignGroupPacket(currentGroupID: string = 'TREK-01'): ForeignPacketTest {
  const incomingGroup = 'TREK-99';
  const filter = filterGroupPacket({ groupID: incomingGroup, senderID: 'X99' }, currentGroupID);

  return {
    incomingGroupID: incomingGroup,
    senderID: 'X99 (Foreign Trekker)',
    messageType: 'FOREIGN_SOS_ALERT',
    timestamp: new Date().toLocaleTimeString(),
    decision: filter.status,
    log: filter.reason,
  };
}
