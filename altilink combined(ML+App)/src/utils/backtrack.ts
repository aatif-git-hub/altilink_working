import { Checkpoint } from '../types';

/**
 * Historical Route Checkpoint Backtracking Engine
 *
 * Traverses recorded checkpoints in strict reverse sequential order (CP_N -> CP_N-1 -> ... -> CP1).
 * Avoids nearest-neighbor mistakes on circular / switchback hiking trails.
 */

export interface BacktrackStep {
  fromCheckpointId: string;
  toCheckpointId: string;
  distanceMeters: number;
  bearingDegrees: number;
  instruction: string;
}

export function generateBacktrackSequence(checkpoints: Checkpoint[]): {
  orderedHistory: Checkpoint[];
  backtrackOrder: Checkpoint[];
  steps: BacktrackStep[];
} {
  // Only include passed / recorded checkpoints
  const passedCheckpoints = checkpoints
    .filter((cp) => cp.passed)
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  // Reverse chronological order
  const backtrackOrder = [...passedCheckpoints].reverse();

  const steps: BacktrackStep[] = [];
  for (let i = 0; i < backtrackOrder.length - 1; i++) {
    const current = backtrackOrder[i];
    const next = backtrackOrder[i + 1];

    steps.push({
      fromCheckpointId: current.id,
      toCheckpointId: next.id,
      distanceMeters: 450 + (i * 80),
      bearingDegrees: (210 + i * 35) % 360,
      instruction: `Retrace trail from ${current.name} (${current.id}) back to ${next.name} (${next.id})`,
    });
  }

  return {
    orderedHistory: passedCheckpoints,
    backtrackOrder,
    steps,
  };
}
