import { BandClient } from '../hardware/bandClient';
import { BleTransport } from '../hardware/bleTransport';
import { BoardEvent } from '../hardware/protocol';
/**
 * AltiLink Communication Service & ML Inference Bridge
 * ===================================================
 * Bridges the React frontend with:
 *   1. Local Python ML Inference Service (POST /api/ml/predict) using the exact
 *      trained Random Forest model (ml-model/models/fall_detector.joblib).
 *   2. Shared Multi-Device Backend State API + BroadcastChannel local mesh fallback.
 *
 * Future hardware architecture:
 * Phone -> BLE -> ESP32-S3 + SX1262 LoRa -> Mesh Broadcast
 */

import {
  EmergencyPacket,
  Member,
  Checkpoint,
  LinkAssessmentResult,
  GroupProfile,
  TrekMode,
  TrailCatalogueItem,
} from '../types';

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
  | 'CHECKPOINT_DELETED'
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
  trekMode?: TrekMode;
  selectedTrail?: TrailCatalogueItem | null;
  checkpointInterval?: number;
  separationThreshold: number;
  activeEmergency: EmergencyPacket | null;
  checkpoints: Checkpoint[];
  linkAssessment?: LinkAssessmentResult;
  updatedAt: number;
}

const BACKEND_URL = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_BACKEND_URL || 'http://localhost:3001';
const CHANNEL_NAME = 'altilink_mesh_channel_v7';
const REGISTRY_KEY = 'altilink_shared_groups_registry_v7';

class CommunicationService {
  public createBandClient(onEvent: (event: BoardEvent) => void, onDisconnect: () => void, onError: (message: string) => void) {
    return new BandClient(new BleTransport(), onEvent, onDisconnect, onError);
  }
  private channel: BroadcastChannel | null = null;
  private listeners: ((message: MeshMessage) => void)[] = [];
  private backendAvailable: boolean = true;
  private syncPollInterval: any = null;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event: MessageEvent<MeshMessage>) => {
          this.notifyListeners(event.data);
        };
      } catch (e) {
        console.warn('BroadcastChannel fallback:', e);
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
   * Broadcast message to all peer windows and sync with backend
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
        console.warn('BroadcastChannel error:', e);
      }
    }

    this.updateSharedRegistry(type, cleanCode, payload);
  }

  // --- Python ML Model Inference API Client ---

  /**
   * Invokes the existing trained Random Forest model in ml-model/models/fall_detector.joblib
   * via the local backend inference server.
   */
  public async predictFallFromIMU(samples: {
    acc_x: number;
    acc_y: number;
    acc_z: number;
    gyro_x: number;
    gyro_y: number;
    gyro_z: number;
  }[]): Promise<{
    prediction: 'FALL' | 'NORMAL';
    label: number;
    confidence: number;
    prob_fall: number;
    prob_normal: number;
    inference_latency_ms: number;
    key_features: {
      peak_accel_g: number;
      max_jerk: number;
      tilt_diff_deg: number;
      mean_tilt_deg: number;
      rms_gyro: number;
    };
    feature_count: number;
    model_type: string;
  } | null> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/ml/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ samples }),
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn('Backend ML inference unavailable, evaluating client pipeline:', e);
    }
    return null;
  }

  /**
   * Fetches official model metrics from ml-model/outputs/metrics.json
   */
  public async getMLMetrics(): Promise<any | null> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/ml/metrics`);
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      // Return local fallback reference metrics
    }
    return {
      dataset: 'SisFall (200 Hz)',
      test_metrics: {
        accuracy: 0.8928,
        precision: 0.744,
        recall: 0.8267,
        f1_score: 0.7832,
      },
    };
  }

  // --- Multi-Device Backend Sync ---

  public async registerGroupOnBackend(
    group: GroupProfile,
    leader: Member,
    trekMode: TrekMode,
    selectedTrail: TrailCatalogueItem | null,
    checkpointInterval: number,
    checkpoints: Checkpoint[] = []
  ) {
    try {
      await fetch(`${BACKEND_URL}/api/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: group.code,
          profile: group,
          members: [leader],
          hikeState: 'GROUP_LOBBY',
          trekMode,
          selectedTrail,
          checkpointInterval,
          checkpoints,
        }),
      });
    } catch (e) {
      // Offline fallback
    }
  }

  public async joinGroupOnBackend(groupCode: string, member: Member): Promise<SharedGroupRecord | null> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/groups/${groupCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Offline fallback
    }
    return null;
  }

  public async startHikeOnBackend(
    groupCode: string,
    trekMode: TrekMode,
    selectedTrail: TrailCatalogueItem | null,
    checkpointInterval: number,
    checkpoints: Checkpoint[]
  ) {
    try {
      await fetch(`${BACKEND_URL}/api/groups/${groupCode}/hike/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trekMode,
          selectedTrail,
          checkpointInterval,
          checkpoints,
        }),
      });
    } catch (e) {
      // Offline fallback
    }
  }

  public async endHikeOnBackend(groupCode: string) {
    try {
      await fetch(`${BACKEND_URL}/api/groups/${groupCode}/hike/end`, {
        method: 'POST',
      });
    } catch (e) {
      // Offline fallback
    }
  }

  public async addCheckpointOnBackend(groupCode: string, checkpoint: Checkpoint) {
    try {
      await fetch(`${BACKEND_URL}/api/groups/${groupCode}/checkpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkpoint }),
      });
    } catch (e) {
      // Offline fallback
    }
  }

  public async deleteCheckpointOnBackend(groupCode: string, checkpointId: string) {
    try {
      await fetch(`${BACKEND_URL}/api/groups/${groupCode}/checkpoints/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkpointId }),
      });
    } catch (e) {
      // Offline fallback
    }
  }

  public async broadcastEmergencyOnBackend(groupCode: string, packet: EmergencyPacket) {
    try {
      await fetch(`${BACKEND_URL}/api/groups/${groupCode}/emergency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packet }),
      });
    } catch (e) {
      // Offline fallback
    }
  }

  public async resolveEmergencyOnBackend(groupCode: string) {
    try {
      await fetch(`${BACKEND_URL}/api/groups/${groupCode}/emergency/resolve`, {
        method: 'POST',
      });
    } catch (e) {
      // Offline fallback
    }
  }

  public async fetchGroupStateFromBackend(groupCode: string): Promise<SharedGroupRecord | null> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/groups/${groupCode}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Fallback to local storage
    }
    return this.getGroupFromRegistry(groupCode);
  }

  // --- Local Registry & Mesh Helpers ---

  public registerGroup(
    group: GroupProfile,
    leaderMember: Member,
    checkpoints: Checkpoint[] = [],
    trekMode: TrekMode = 'EXISTING',
    selectedTrail: TrailCatalogueItem | null = null,
    checkpointInterval: number = 5
  ) {
    try {
      const registry = this.getSharedRegistry();
      const code = group.code.trim().toUpperCase();
      registry[code] = {
        profile: group,
        members: [leaderMember],
        hikeState: 'GROUP_LOBBY',
        trekMode,
        selectedTrail,
        checkpointInterval,
        separationThreshold: 400,
        activeEmergency: null,
        checkpoints: checkpoints.length > 0 ? checkpoints : [],
        updatedAt: Date.now(),
      };
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
    } catch (e) {
      console.warn('Registry storage warning:', e);
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
      // Ignored
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
      // Ignored
    }
  }

  public updateHikeStateInRegistry(
    groupCode: string,
    hikeState: string,
    trekMode?: TrekMode,
    selectedTrail?: TrailCatalogueItem | null,
    checkpointInterval?: number
  ) {
    try {
      const registry = this.getSharedRegistry();
      const code = groupCode.trim().toUpperCase();
      if (registry[code]) {
        registry[code].hikeState = hikeState;
        if (trekMode) registry[code].trekMode = trekMode;
        if (selectedTrail !== undefined) registry[code].selectedTrail = selectedTrail;
        if (checkpointInterval) registry[code].checkpointInterval = checkpointInterval;
        registry[code].updatedAt = Date.now();
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
      }
    } catch (e) {
      // Ignored
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
      // Ignored
    }
  }

  public deleteCheckpointFromRegistry(groupCode: string, checkpointId: string) {
    try {
      const registry = this.getSharedRegistry();
      const code = groupCode.trim().toUpperCase();
      if (registry[code] && registry[code].checkpoints) {
        registry[code].checkpoints = registry[code].checkpoints.filter((c: Checkpoint) => c.id !== checkpointId);
        registry[code].updatedAt = Date.now();
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
      }
    } catch (e) {
      // Ignored
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
      // Ignored
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
        if (payload.trekMode) registry[code].trekMode = payload.trekMode;
        if (payload.selectedTrail) registry[code].selectedTrail = payload.selectedTrail;
        if (payload.checkpointInterval) registry[code].checkpointInterval = payload.checkpointInterval;
      } else if (type === 'HIKE_ENDED') {
        registry[code].hikeState = 'GROUP_LOBBY';
        registry[code].activeEmergency = null;
      } else if (type === 'EMERGENCY_BROADCAST' && payload.packet) {
        registry[code].activeEmergency = payload.packet;
      } else if (type === 'EMERGENCY_RESOLVED') {
        registry[code].activeEmergency = null;
      } else if (type === 'CHECKPOINT_ADDED' && payload.checkpoint) {
        const existing = registry[code].checkpoints || [];
        registry[code].checkpoints = [...existing.filter((c: Checkpoint) => c.id !== payload.checkpoint.id), payload.checkpoint];
      } else if (type === 'CHECKPOINT_DELETED' && payload.checkpointId) {
        const existing = registry[code].checkpoints || [];
        registry[code].checkpoints = existing.filter((c: Checkpoint) => c.id !== payload.checkpointId);
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
