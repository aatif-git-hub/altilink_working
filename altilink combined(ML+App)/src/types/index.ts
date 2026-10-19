export type ConnectionStatus = 'Connected' | 'Warning' | 'Disconnected';
export type MemberEmergencyStatus = 'Safe' | 'Warning' | 'Emergency';
export type GroupOverallStatus = 'SAFE' | 'WARNING' | 'EMERGENCY';

export type HikeLifecycleState =
  | 'WELCOME'
  | 'CREATE_GROUP'
  | 'JOIN_GROUP'
  | 'GROUP_LOBBY'
  | 'ACTIVE_HIKE'
  | 'ENDED_HIKE';

export interface LocationCoordinate {
  latitude: number;
  longitude: number;
  altitude?: number;
}

export interface GroupProfile {
  id: string; // e.g. 'ALT-7K4P'
  code: string; // e.g. 'ALT-7K4P'
  name: string; // e.g. 'Western Ghats Trek'
  createdAt: string;
  leaderId: string;
}

export interface UserProfile {
  name: string;
  memberId: string;
  isLeader: boolean;
}

export interface Member {
  id: string; // e.g. 'M01'
  name: string; // e.g. 'Nirmal'
  latitude: number;
  longitude: number;
  altitude?: number;
  distance: number; // distance in meters from group reference/leader
  connectionStatus: ConnectionStatus;
  emergencyStatus: MemberEmergencyStatus;
  battery?: number; // percentage (e.g. 88%)
  lastSeen?: string; // e.g. 'Just now'
  isLeader?: boolean;
  isCurrentUser?: boolean;
  rssi?: number;
  snr?: number;
}

export interface EmergencyPacket {
  packetID: string;
  groupID: string;
  senderID: string;
  senderName: string;
  messageType: 'SOS' | 'FALL_DETECTED' | 'MANUAL_SOS';
  latitude: number;
  longitude: number;
  altitude: number;
  timestamp: string;
  rawPayloadHex?: string;
  status: 'PENDING' | 'BROADCASTING' | 'RECEIVED' | 'REJECTED';
}

export interface BroadcastRecipientStatus {
  memberId: string;
  memberName: string;
  received: boolean;
  receivedAt?: string;
  rssi?: number;
  ackSent: boolean;
}

export interface Checkpoint {
  id: string; // e.g. 'CP1'
  name: string;
  latitude: number;
  longitude: number;
  altitude: number;
  sequenceNumber: number;
  timestamp: string;
  passed: boolean;
  notes?: string;
}

export type TerrainType = 'OPEN_TERRAIN' | 'DENSE_FOREST' | 'MOUNTAINOUS_TERRAIN';

export interface TerrainProfile {
  id: TerrainType;
  name: string;
  description: string;
  rfAttenuationFactor: string;
  defaultMeasurements: LinkMeasurement[];
  recommendedMaxRange: number;
}

export interface LinkMeasurement {
  distance: number; // in meters (e.g., 100, 200, 300, 400, 500, 600)
  rssi: number; // in dBm
  snr: number; // in dB
  packetSuccess: number; // percentage (0 - 100)
  ackReliability: number; // percentage (0 - 100)
  quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'UNUSABLE';
}

export interface LinkAssessmentResult {
  lastEvaluatedAt: string;
  terrain: TerrainType;
  reliableBoundary: number; // e.g. 400 m
  safetyMarginPercent: number; // e.g. 20%
  recommendedGroupLimit: number; // e.g. 320 m
  overallQuality: 'EXCELLENT' | 'GOOD' | 'MARGINAL' | 'POOR';
  avgRssi: number;
  avgSnr: number;
  avgPacketSuccess: number;
  measurements: LinkMeasurement[];
}

export interface IMUSensorData {
  accelX: number;
  accelY: number;
  accelZ: number;
  gyroX: number;
  gyroY: number;
  gyroZ: number;
  totalG: number;
  tinyMLStatus: 'NORMAL ACTIVITY' | 'POSSIBLE FALL' | 'CONFIRMED FALL';
  confidence: number;
  lastSampleTime: string;
}

export interface WearableDeviceState {
  model: string;
  bleStatus: 'CONNECTED' | 'DISCONNECTED';
  buzzerVibration: 'IDLE' | 'ACTIVE';
}

export interface ForeignPacketTest {
  incomingGroupID: string;
  senderID: string;
  messageType: string;
  timestamp: string;
  decision: 'ACCEPTED' | 'IGNORED — FOREIGN GROUP';
  log: string;
}

export interface TestCaseResult {
  id: string;
  title: string;
  category: string;
  description: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL' | 'PENDING';
  details: string;
}
