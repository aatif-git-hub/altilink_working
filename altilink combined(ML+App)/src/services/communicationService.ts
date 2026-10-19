/**
 * AltiLink Local Prototype Communication Service
 *
 * Simulates peer-to-peer LoRa RF broadcast mesh using browser-native BroadcastChannel
 * and shared group registry in localStorage.
 *
 * Architecture:
 * UI -> Application State -> Communication Service -> BroadcastChannel (Simulated LoRa mesh)
 *
 * Enables multi-user cross-window interactions:
 * - Window 1 (e.g. Nirmal M01) creates group ALT-7K4P.
 * - Window 2 (e.g. Rahul M02) joins group ALT-7K4P.
 * - Starting a hike, updating simulated member locations, assessing link boundaries,
 *   or triggering an emergency distress beacon immediately propagates across all group sessions in real time.
 *
 * In physical hardware, this service layer is replaced by the ESP32-S3 SX1262 LoRa driver.
 */

import { EmergencyPacket, Member, Checkpoint, LinkAssessmentResult, GroupProfile } from '../types';

export type MeshMessageType =
  | 'MEMBER_JOINED'
  | 'MEMBER_REMOVED'
  | 'HIKE_STARTED'
  | 'HIKE_ENDED'
  | 'LOCATION_UPDATE'
  | 'EMERGENCY_BROADCAST'
  | 'EMERGENCY_ACK'
  | 'EMERGENCY_RESOLVED'
  | 'LINK_UPDATE'
  | 'CHECKPOINT_ADDED'
  | 'SYNC_REQUEST'
  | 'SYNC_RESPONSE';

export interface MeshMessage {
  type: MeshMessageType;
  groupCode: string;
  senderId?: string;
  timestamp: string;
  payload: any;
}

export interface SharedGroupRecord {
  profile: GroupProfile;
  members: Member[];
  hikeState: string;
  separationThreshold: number;
  activeEmergency: EmergencyPacket | null;
  checkpoints: Checkpoint[];
  linkAssessment?: LinkAssessmentResult;
  updatedAt: number;
}

const CHANNEL_NAME = 'altilink_mesh_channel';
const REGISTRY_KEY = 'altilink_shared_groups_registry';

class CommunicationService {
  private channel: BroadcastChannel | null = null;
  private listeners: ((message: MeshMessage) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event: MessageEvent<MeshMessage>) => {
          this.notifyListeners(event.data);
        };
      } catch (e) {
        console.warn('BroadcastChannel initialization failed, falling back to storage events:', e);
      }
    }
  }

  public subscribe(listener: (message: MeshMessage) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(message: MeshMessage) {
    this.listeners.forEach((listener) => {
      try {
        listener(message);
      } catch (err) {
        console.error('Error in mesh message listener:', err);
      }
    });
  }

  /**
   * Broadcast message to all active peer windows / tabs
   */
  public send(type: MeshMessageType, groupCode: string, payload: any = {}, senderId?: string) {
    const cleanCode = groupCode.trim().toUpperCase();
    const message: MeshMessage = {
      type,
      groupCode: cleanCode,
      senderId,
      timestamp: new Date().toLocaleTimeString(),
      payload,
    };

    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch (e) {
        console.warn('Failed to post message on BroadcastChannel:', e);
      }
    }

    // Keep shared localStorage registry in sync
    this.updateSharedRegistry(type, cleanCode, payload);
  }

  /**
   * Convenience helpers for conceptual product communication layer
   */
  public sendGroupMessage(groupCode: string, type: MeshMessageType, payload: any, senderId?: string) {
    this.send(type, groupCode, payload, senderId);
  }

  public sendEmergency(groupCode: string, packet: EmergencyPacket, senderId?: string) {
    this.send('EMERGENCY_BROADCAST', groupCode, { packet }, senderId);
  }

  public sendEmergencyAck(groupCode: string, packetId: string, memberId: string, memberName: string) {
    this.send('EMERGENCY_ACK', groupCode, { packetId, memberId, memberName }, memberId);
  }

  public sendEmergencyResolved(groupCode: string, senderId?: string) {
    this.send('EMERGENCY_RESOLVED', groupCode, {}, senderId);
  }

  // Shared Registry in localStorage for reliable group discovery and cross-tab recovery
  public registerGroup(group: GroupProfile, leaderMember: Member, checkpoints: Checkpoint[] = []) {
    try {
      const registry = this.getSharedRegistry();
      const code = group.code.trim().toUpperCase();
      registry[code] = {
        profile: group,
        members: [leaderMember],
        hikeState: 'GROUP_LOBBY',
        separationThreshold: 400,
        activeEmergency: null,
        checkpoints: checkpoints.length > 0 ? checkpoints : [],
        updatedAt: Date.now(),
      };
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
    } catch (e) {
      console.warn('Failed to register group in localStorage registry:', e);
    }
  }

  public getGroupFromRegistry(groupCode: string): SharedGroupRecord | null {
    try {
      const registry = this.getSharedRegistry();
      return registry[groupCode.trim().toUpperCase()] || null;
    } catch (e) {
      return null;
    }
  }

  public addMemberToRegistry(groupCode: string, member: Member) {
    try {
      const registry = this.getSharedRegistry();
      const code = groupCode.trim().toUpperCase();
      if (registry[code]) {
        const existing = registry[code].members.filter((m: Member) => m.id !== member.id);
        registry[code].members = [...existing, member];
        registry[code].updatedAt = Date.now();
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
      }
    } catch (e) {
      console.warn('Failed to update member in registry:', e);
    }
  }

  public removeMemberFromRegistry(groupCode: string, memberId: string) {
    try {
      const registry = this.getSharedRegistry();
      const code = groupCode.trim().toUpperCase();
      if (registry[code]) {
        registry[code].members = registry[code].members.filter((m: Member) => m.id !== memberId);
        registry[code].updatedAt = Date.now();
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
      }
    } catch (e) {
      console.warn('Failed to remove member from registry:', e);
    }
  }

  public updateHikeStateInRegistry(groupCode: string, hikeState: string) {
    try {
      const registry = this.getSharedRegistry();
      const code = groupCode.trim().toUpperCase();
      if (registry[code]) {
        registry[code].hikeState = hikeState;
        registry[code].updatedAt = Date.now();
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
      }
    } catch (e) {
      console.warn('Failed to update hike state in registry:', e);
    }
  }

  public updateThresholdInRegistry(groupCode: string, threshold: number, assessment?: LinkAssessmentResult) {
    try {
      const registry = this.getSharedRegistry();
      const code = groupCode.trim().toUpperCase();
      if (registry[code]) {
        registry[code].separationThreshold = threshold;
        if (assessment) {
          registry[code].linkAssessment = assessment;
        }
        registry[code].updatedAt = Date.now();
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
      }
    } catch (e) {
      console.warn('Failed to update threshold in registry:', e);
    }
  }

  public updateMemberLocationInRegistry(groupCode: string, memberId: string, latitude: number, longitude: number, distance: number) {
    try {
      const registry = this.getSharedRegistry();
      const code = groupCode.trim().toUpperCase();
      if (registry[code]) {
        registry[code].members = registry[code].members.map((m: Member) =>
          m.id === memberId
            ? { ...m, latitude, longitude, distance, lastSeen: 'Just now' }
            : m
        );
        registry[code].updatedAt = Date.now();
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
      }
    } catch (e) {
      console.warn('Failed to update member location in registry:', e);
    }
  }

  public addCheckpointToRegistry(groupCode: string, checkpoint: Checkpoint) {
    try {
      const registry = this.getSharedRegistry();
      const code = groupCode.trim().toUpperCase();
      if (registry[code]) {
        const existing = registry[code].checkpoints || [];
        registry[code].checkpoints = [...existing.filter((c: Checkpoint) => c.id !== checkpoint.id), checkpoint];
        registry[code].updatedAt = Date.now();
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
      }
    } catch (e) {
      console.warn('Failed to add checkpoint in registry:', e);
    }
  }

  public setEmergencyInRegistry(groupCode: string, packet: EmergencyPacket | null) {
    try {
      const registry = this.getSharedRegistry();
      const code = groupCode.trim().toUpperCase();
      if (registry[code]) {
        registry[code].activeEmergency = packet;
        registry[code].updatedAt = Date.now();
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
      }
    } catch (e) {
      console.warn('Failed to update emergency in registry:', e);
    }
  }

  private updateSharedRegistry(type: MeshMessageType, groupCode: string, payload: any) {
    try {
      const registry = this.getSharedRegistry();
      const code = groupCode.trim().toUpperCase();
      if (!registry[code]) return;

      if (type === 'MEMBER_JOINED' && payload.member) {
        const existing = registry[code].members.filter((m: Member) => m.id !== payload.member.id);
        registry[code].members = [...existing, payload.member];
      } else if (type === 'MEMBER_REMOVED' && payload.memberId) {
        registry[code].members = registry[code].members.filter((m: Member) => m.id !== payload.memberId);
      } else if (type === 'HIKE_STARTED') {
        registry[code].hikeState = 'ACTIVE_HIKE';
      } else if (type === 'HIKE_ENDED') {
        registry[code].hikeState = 'GROUP_LOBBY';
        registry[code].activeEmergency = null;
      } else if (type === 'LOCATION_UPDATE' && payload.memberId) {
        registry[code].members = registry[code].members.map((m: Member) =>
          m.id === payload.memberId
            ? { ...m, latitude: payload.latitude, longitude: payload.longitude, distance: payload.distance, lastSeen: 'Just now' }
            : m
        );
      } else if (type === 'LINK_UPDATE' && payload.threshold) {
        registry[code].separationThreshold = payload.threshold;
        if (payload.assessment) {
          registry[code].linkAssessment = payload.assessment;
        }
      } else if (type === 'EMERGENCY_BROADCAST' && payload.packet) {
        registry[code].activeEmergency = payload.packet;
      } else if (type === 'EMERGENCY_RESOLVED') {
        registry[code].activeEmergency = null;
      } else if (type === 'CHECKPOINT_ADDED' && payload.checkpoint) {
        const existing = registry[code].checkpoints || [];
        registry[code].checkpoints = [...existing.filter((c: Checkpoint) => c.id !== payload.checkpoint.id), payload.checkpoint];
      }

      registry[code].updatedAt = Date.now();
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
    } catch (e) {
      // Ignored
    }
  }

  public getSharedRegistry(): Record<string, SharedGroupRecord> {
    try {
      const raw = localStorage.getItem(REGISTRY_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
}

export const communicationService = new CommunicationService();
