import { TrailCatalogueItem, Checkpoint } from '../types';

// Default base coordinates set to Kudremukh National Park Trailhead (Western Ghats, Karnataka)
export const DEFAULT_BASE_LATITUDE = 13.1780;
export const DEFAULT_BASE_LONGITUDE = 75.2850;
export const DEFAULT_BASE_ALTITUDE = 820;

export const DEFAULT_SEPARATION_THRESHOLD = 400; // in meters
export const DEFAULT_SAFETY_MARGIN = 20; // 20%
export const DEFAULT_CHECKPOINT_INTERVAL_MINUTES = 5;

export function generateGroupCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'ALT-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Real Hiking Trail Catalogue in Western Ghats Wilderness
 */
export const TRAIL_CATALOGUE: TrailCatalogueItem[] = [
  {
    id: 'trail-kudremukh',
    name: 'Kudremukh Peak Trail',
    distanceKm: 9.4,
    difficulty: 'Moderate',
    durationHours: '4.5 hrs',
    elevationGainMeters: 1074,
    description: 'Scenic mountain ascent through shola grasslands, mountain streams, and rolling Western Ghats ridges to Kudremukh Peak (1,894m).',
    waypointsCount: 6,
    trailheadCoords: { latitude: 13.1780, longitude: 75.2850, altitude: 820 },
    routeCoordinates: [
      [13.1780, 75.2850], // Muleodi Trailhead Checkpost (820m)
      [13.1672, 75.2815], // Somavathi River Crossing (940m)
      [13.1550, 75.2770], // Ontimane Lobo House (1120m)
      [13.1435, 75.2725], // Shola Grassland Ridge (1350m)
      [13.1360, 75.2695], // Zig-Zag Ascent Section (1580m)
      [13.1310, 75.2682], // Final Mountain Ridge Crest (1780m)
      [13.1285, 75.2678], // Kudremukh Peak Summit (1894m)
    ],
  },
  {
    id: 'trail-western-ghats-ridge',
    name: 'Western Ghats Ridge Trail',
    distanceKm: 7.2,
    difficulty: 'Moderate',
    durationHours: '3.5 hrs',
    elevationGainMeters: 640,
    description: 'Continuous mountain ridgeline expedition along Pushpagiri with wide RF line-of-sight and valley viewpoints.',
    waypointsCount: 5,
    trailheadCoords: { latitude: 12.6782, longitude: 75.6025, altitude: 350 },
    routeCoordinates: [
      [12.6782, 75.6025], // Base Trailhead Checkpost (350m)
      [12.6720, 75.6185], // Meadow Crossing (780m)
      [12.6685, 75.6320], // Rock Shelter Waypoint (1150m)
      [12.6640, 75.6480], // Ridge Lookout Point (1520m)
      [12.6615, 75.6575], // Pushpagiri Ridge Summit (1712m)
    ],
  },
  {
    id: 'trail-brahmagiri',
    name: 'Brahmagiri Sanctuary Loop',
    distanceKm: 12.2,
    difficulty: 'Challenging',
    durationHours: '6.0 hrs',
    elevationGainMeters: 858,
    description: 'Dense tropical evergreen sanctuary trail ascending through rocky gorges and historical high-altitude streams.',
    waypointsCount: 5,
    trailheadCoords: { latitude: 11.9680, longitude: 75.9890, altitude: 750 },
    routeCoordinates: [
      [11.9680, 75.9890], // Iruppu Forest Gate Trailhead (750m)
      [11.9595, 75.9960], // Upper Forest Stream Crossing (980m)
      [11.9480, 76.0075], // Munikal Cave Waypoint (1240m)
      [11.9390, 76.0160], // Grassland Ridge Camp (1420m)
      [11.9285, 76.0240], // Brahmagiri Peak Summit (1608m)
    ],
  },
];

export const DEFAULT_TRAIL = TRAIL_CATALOGUE[0];

/**
 * Initial route checkpoints created on demand when starting a hike
 */
export const DEFAULT_HIKE_CHECKPOINTS: Checkpoint[] = [
  {
    id: 'CP1',
    name: 'Muleodi Trailhead',
    latitude: 13.1780,
    longitude: 75.2850,
    altitude: 820,
    sequenceNumber: 1,
    timestamp: '00:05',
    passed: true,
    notes: 'Base camp gear check & LoRa mesh sync point.',
  },
  {
    id: 'CP2',
    name: 'Somavathi River Crossing',
    latitude: 13.1672,
    longitude: 75.2815,
    altitude: 940,
    sequenceNumber: 2,
    timestamp: '00:10',
    passed: true,
    notes: 'Stream crossing; stable RF line of sight.',
  },
  {
    id: 'CP3',
    name: 'Ontimane Ridge Lookout',
    latitude: 13.1550,
    longitude: 75.2770,
    altitude: 1120,
    sequenceNumber: 3,
    timestamp: '00:15',
    passed: true,
    notes: 'Cluster checkpoint before Shola grassland ascent.',
  },
];
