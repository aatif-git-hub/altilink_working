import { describe, it, expect } from 'vitest';
import { calculateHaversineDistance, checkSeparationStatus } from '../utils/haversine';
import { evaluateLoRaLink, TERRAIN_DATASETS } from '../utils/linkAssessment';
import { filterGroupPacket, createSimulatedPacket } from '../utils/groupFilter';
import { generateBacktrackSequence } from '../utils/backtrack';
import { DEFAULT_HIKE_CHECKPOINTS, DEFAULT_BASE_LATITUDE, DEFAULT_BASE_LONGITUDE } from '../data/initialData';

describe('AltiLink Core Algorithms Suite', () => {
  // 1. Haversine GPS Distance & Group Separation Logic
  describe('Haversine Distance & Separation Logic', () => {
    it('calculates geographic distance accurately between two coordinates', () => {
      const p1 = { latitude: 13.0827, longitude: 80.2707 };
      const p2 = { latitude: 13.0860, longitude: 80.2770 };
      const dist = calculateHaversineDistance(p1, p2);
      expect(dist).toBeGreaterThan(600);
      expect(dist).toBeLessThan(850);
    });

    it('returns 0 meters for identical coordinates', () => {
      const p = { latitude: 13.0827, longitude: 80.2707 };
      const dist = calculateHaversineDistance(p, p);
      expect(dist).toBe(0);
    });

    it('identifies safe member status when distance is within dynamic threshold', () => {
      const status = checkSeparationStatus(210, 400);
      expect(status.isExceeded).toBe(false);
      expect(status.statusText).toBe('Safe');
    });

    it('triggers separation warning when member distance exceeds threshold', () => {
      const status = checkSeparationStatus(480, 400);
      expect(status.isExceeded).toBe(true);
      expect(status.statusText).toBe('Warning');
    });
  });

  // 2. Adaptive LoRa Link Assessment & Dynamic Separation Threshold
  describe('Adaptive Link Assessment & Threshold Calculation', () => {
    it('computes reliable boundary for Dense Forest profile', () => {
      const result = evaluateLoRaLink('DENSE_FOREST', 20);
      expect(result.reliableBoundary).toBe(400);
      expect(result.recommendedGroupLimit).toBe(320); // 400 * (1 - 0.20)
    });

    it('increases reliable boundary under Open Ridge conditions', () => {
      const result = evaluateLoRaLink('OPEN_TERRAIN', 20);
      expect(result.reliableBoundary).toBe(600);
      expect(result.recommendedGroupLimit).toBe(480); // 600 * (1 - 0.20)
    });

    it('decreases reliable boundary under Mountainous conditions', () => {
      const result = evaluateLoRaLink('MOUNTAINOUS_TERRAIN', 20);
      expect(result.reliableBoundary).toBe(300);
      expect(result.recommendedGroupLimit).toBe(240); // 300 * (1 - 0.20)
    });

    it('dynamically adapts threshold based on custom safety margin', () => {
      const result10 = evaluateLoRaLink('DENSE_FOREST', 10);
      expect(result10.recommendedGroupLimit).toBe(360); // 400 * 0.90

      const result30 = evaluateLoRaLink('DENSE_FOREST', 30);
      expect(result30.recommendedGroupLimit).toBe(280); // 400 * 0.70
    });
  });

  // 3. Group ID Privacy and Foreign Packet Rejection
  describe('Group ID Privacy Filter', () => {
    it('accepts packets when groupID matches local group', () => {
      const packet = createSimulatedPacket('ALT-7K4P', 'M03', 'SOS');
      const filter = filterGroupPacket(packet, 'ALT-7K4P');
      expect(filter.accepted).toBe(true);
      expect(filter.status).toBe('ACCEPTED');
    });

    it('rejects foreign group packets to prevent crosstalk and alert fatigue', () => {
      const packet = createSimulatedPacket('ALT-9999', 'X99', 'SOS');
      const filter = filterGroupPacket(packet, 'ALT-7K4P');
      expect(filter.accepted).toBe(false);
      expect(filter.status).toBe('IGNORED — FOREIGN GROUP');
    });

    it('handles case-insensitive group ID comparison', () => {
      const packet = createSimulatedPacket('alt-7k4p', 'M02', 'SOS');
      const filter = filterGroupPacket(packet, 'ALT-7K4P');
      expect(filter.accepted).toBe(true);
    });
  });

  // 4. Checkpoint Backtracking
  describe('Sequential Route Backtracking', () => {
    it('reverses passed checkpoints in strict chronological sequence', () => {
      const backtrack = generateBacktrackSequence(DEFAULT_HIKE_CHECKPOINTS);
      expect(backtrack.backtrackOrder.length).toBe(3);
      expect(backtrack.backtrackOrder[0].id).toBe('CP3');
      expect(backtrack.backtrackOrder[1].id).toBe('CP2');
      expect(backtrack.backtrackOrder[2].id).toBe('CP1');
    });

    it('generates directional navigation steps between sequential waypoints', () => {
      const backtrack = generateBacktrackSequence(DEFAULT_HIKE_CHECKPOINTS);
      expect(backtrack.steps.length).toBe(2);
      expect(backtrack.steps[0].fromCheckpointId).toBe('CP3');
      expect(backtrack.steps[0].toCheckpointId).toBe('CP2');
      expect(backtrack.steps[1].fromCheckpointId).toBe('CP2');
      expect(backtrack.steps[1].toCheckpointId).toBe('CP1');
    });
  });
});
