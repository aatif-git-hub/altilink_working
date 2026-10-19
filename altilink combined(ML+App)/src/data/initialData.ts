import { Checkpoint, TerrainType } from '../types';

export const DEFAULT_BASE_LATITUDE = 13.0827;
export const DEFAULT_BASE_LONGITUDE = 80.2707;
export const DEFAULT_BASE_ALTITUDE = 420;

export const DEFAULT_SEPARATION_THRESHOLD = 400; // in meters
export const DEFAULT_SAFETY_MARGIN = 20; // 20%

export function generateGroupCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'ALT-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Initial default route checkpoints created upon starting a hike (can be customized/extended by user)
export const DEFAULT_HIKE_CHECKPOINTS: Checkpoint[] = [
  {
    id: 'CP1',
    name: 'Pine Valley Trailhead',
    latitude: 13.0815,
    longitude: 80.2690,
    altitude: 320,
    sequenceNumber: 1,
    timestamp: '08:30 AM',
    passed: true,
    notes: 'Base camp gear check & LoRa mesh sync point.',
  },
  {
    id: 'CP2',
    name: 'Eagle Ridge Stream Crossing',
    latitude: 13.0828,
    longitude: 80.2712,
    altitude: 365,
    sequenceNumber: 2,
    timestamp: '09:15 AM',
    passed: true,
    notes: 'Water crossing; stable RF line of sight.',
  },
  {
    id: 'CP3',
    name: 'Granite Pass Lookpoint',
    latitude: 13.0843,
    longitude: 80.2740,
    altitude: 412,
    sequenceNumber: 3,
    timestamp: '10:05 AM',
    passed: true,
    notes: 'Current cluster checkpoint before northern ridge ascent.',
  },
];
