import { Checkpoint } from '../types';
import { calculateHaversineDistance } from './haversine';

/**
 * Historical Route Checkpoint Backtracking Engine
 *
 * Traverses recorded checkpoints in strict reverse sequential order (CP_N -> CP_N-1 -> ... -> CP1 -> Start).
 * Avoids nearest-neighbor mistakes on circular / switchback hiking trails.
 * Supports any arbitrary number of dynamically recorded checkpoints.
 */

export interface BacktrackStep {
  stepIndex: number;
  fromCheckpointId: string;
  fromCheckpointName: string;
  toCheckpointId: string;
  toCheckpointName: string;
  distanceMeters: number;
  bearingDegrees: number;
  instruction: string;
  targetCoords: { latitude: number; longitude: number; altitude: number };
}

function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const y = Math.sin(dLon) * Math.cos(lat2 * (Math.PI / 180));
  const x =
    Math.cos(lat1 * (Math.PI / 180)) * Math.sin(lat2 * (Math.PI / 180)) -
    Math.sin(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.cos(dLon);
  let brng = Math.atan2(y, x) * (180 / Math.PI);
  return Math.round((brng + 360) % 360);
}

export function generateBacktrackSequence(checkpoints: Checkpoint[]): {
  orderedHistory: Checkpoint[];
  backtrackOrder: Checkpoint[];
  steps: BacktrackStep[];
} {
  // Only include passed / recorded checkpoints, sorted by sequence number
  const passedCheckpoints = (checkpoints || [])
    .filter((cp) => cp.passed)
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  // Reverse chronological order: latest checkpoint first
  const backtrackOrder = [...passedCheckpoints].reverse();

  const steps: BacktrackStep[] = [];
  for (let i = 0; i < backtrackOrder.length - 1; i++) {
    const current = backtrackOrder[i];
    const next = backtrackOrder[i + 1];

    const dist = calculateHaversineDistance(
      { latitude: current.latitude, longitude: current.longitude },
      { latitude: next.latitude, longitude: next.longitude }
    );

    const bearing = calculateBearing(
      current.latitude,
      current.longitude,
      next.latitude,
      next.longitude
    );

    steps.push({
      stepIndex: i + 1,
      fromCheckpointId: current.id,
      fromCheckpointName: current.name,
      toCheckpointId: next.id,
      toCheckpointName: next.name,
      distanceMeters: Math.max(50, Math.round(dist)),
      bearingDegrees: bearing,
      instruction: `Retrace trail from ${current.name} (${current.id}) back toward ${next.name} (${next.id})`,
      targetCoords: {
        latitude: next.latitude,
        longitude: next.longitude,
        altitude: next.altitude,
      },
    });
  }

  return {
    orderedHistory: passedCheckpoints,
    backtrackOrder,
    steps,
  };
}
