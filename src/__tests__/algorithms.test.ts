import { describe, it, expect } from 'vitest';
import { calculateHaversineDistance, checkSeparationStatus } from '../utils/haversine';
import { evaluateLoRaLink, TERRAIN_DATASETS } from '../utils/linkAssessment';
import { filterGroupPacket, createSimulatedPacket } from '../utils/groupFilter';
import { generateBacktrackSequence } from '../utils/backtrack';
import {
  DEFAULT_HIKE_CHECKPOINTS,
  DEFAULT_BASE_LATITUDE,
  DEFAULT_BASE_LONGITUDE,
  generateGroupCode,
  TRAIL_CATALOGUE,
} from '../data/initialData';
import { Checkpoint } from '../types';

describe('AltiLink Core Algorithms Suite', () => {
  // 1. Group Creation & Code Generation
  describe('Group Management & Security', () => {
    it('generates a valid 8-character group code with ALT- prefix', () => {
      const code = generateGroupCode();
      expect(code).toMatch(/^ALT-[A-Z0-9]{4}$/);
    });

    it('creates trail catalogue with real Western Ghats coordinates and distance metrics', () => {
      expect(TRAIL_CATALOGUE.length).toBeGreaterThanOrEqual(3);
      const kudremukh = TRAIL_CATALOGUE[0];
      expect(kudremukh.name).toContain('Kudremukh');
      expect(kudremukh.distanceKm).toBeGreaterThan(5);
      expect(kudremukh.routeCoordinates.length).toBeGreaterThan(3);
      // Verify trailhead is located at Kudremukh wilderness coordinates (~13.17N, 75.28E)
      expect(kudremukh.trailheadCoords.latitude).toBeCloseTo(13.178, 2);
      expect(kudremukh.trailheadCoords.longitude).toBeCloseTo(75.285, 2);
    });
  });

  // 2. Haversine GPS Distance & Group Geometry
  describe('Haversine Distance & Separation Logic', () => {
    it('calculates geographic distance accurately between two coordinates', () => {
      const p1 = { latitude: 13.1780, longitude: 75.2850 };
      const p2 = { latitude: 13.1672, longitude: 75.2815 };
      const dist = calculateHaversineDistance(p1, p2);
      expect(dist).toBeGreaterThan(1000);
      expect(dist).toBeLessThan(1400);
    });

    it('returns 0 meters for identical coordinates', () => {
      const p = { latitude: 13.1780, longitude: 75.2850 };
      const dist = calculateHaversineDistance(p, p);
      expect(dist).toBe(0);
    });

    it('identifies safe member status when distance is within threshold', () => {
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

  // 3. Communication Check (Link Assessment)
  describe('Communication Check & Range Estimation', () => {
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

  // 4. Group ID Privacy & Foreign Packet Rejection
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

  // 5. Dynamic Checkpoints & Sequential Backtracking
  describe('Dynamic Checkpoint Recording & Sequential Route Backtracking', () => {
    it('reverses default hike checkpoints in strict reverse sequence', () => {
      const backtrack = generateBacktrackSequence(DEFAULT_HIKE_CHECKPOINTS);
      expect(backtrack.backtrackOrder.length).toBe(3);
      expect(backtrack.backtrackOrder[0].id).toBe('CP3');
      expect(backtrack.backtrackOrder[1].id).toBe('CP2');
      expect(backtrack.backtrackOrder[2].id).toBe('CP1');
    });

    it('handles arbitrary dynamic checkpoint sequences (e.g. 5 dynamically generated checkpoints)', () => {
      const dynamicCps: Checkpoint[] = [
        { id: 'CP1', name: 'Start', latitude: 13.1780, longitude: 75.2850, altitude: 820, sequenceNumber: 1, timestamp: '00:00', passed: true },
        { id: 'CP2', name: 'Marker 2', latitude: 13.1672, longitude: 75.2815, altitude: 940, sequenceNumber: 2, timestamp: '00:05', passed: true },
        { id: 'CP3', name: 'Marker 3', latitude: 13.1550, longitude: 75.2770, altitude: 1120, sequenceNumber: 3, timestamp: '00:10', passed: true },
        { id: 'CP4', name: 'Marker 4', latitude: 13.1435, longitude: 75.2725, altitude: 1350, sequenceNumber: 4, timestamp: '00:15', passed: true },
        { id: 'CP5', name: 'Marker 5', latitude: 13.1285, longitude: 75.2678, altitude: 1894, sequenceNumber: 5, timestamp: '00:20', passed: true },
      ];

      const backtrack = generateBacktrackSequence(dynamicCps);
      expect(backtrack.backtrackOrder.length).toBe(5);
      expect(backtrack.backtrackOrder[0].id).toBe('CP5');
      expect(backtrack.backtrackOrder[4].id).toBe('CP1');
      expect(backtrack.steps.length).toBe(4);
      expect(backtrack.steps[0].fromCheckpointId).toBe('CP5');
      expect(backtrack.steps[0].toCheckpointId).toBe('CP4');
      expect(backtrack.steps[3].fromCheckpointId).toBe('CP2');
      expect(backtrack.steps[3].toCheckpointId).toBe('CP1');
    });

    it('excludes deleted checkpoints from backtracking sequence', () => {
      const initialCps: Checkpoint[] = [
        { id: 'CP1', name: 'Start', latitude: 13.1780, longitude: 75.2850, altitude: 820, sequenceNumber: 1, timestamp: '00:00', passed: true },
        { id: 'CP2', name: 'Marker 2', latitude: 13.1672, longitude: 75.2815, altitude: 940, sequenceNumber: 2, timestamp: '00:05', passed: true },
        { id: 'CP3', name: 'Marker 3', latitude: 13.1550, longitude: 75.2770, altitude: 1120, sequenceNumber: 3, timestamp: '00:10', passed: true },
      ];

      // Delete CP2
      const afterDeletion = initialCps.filter((c) => c.id !== 'CP2');
      const backtrack = generateBacktrackSequence(afterDeletion);

      expect(backtrack.backtrackOrder.length).toBe(2);
      expect(backtrack.backtrackOrder[0].id).toBe('CP3');
      expect(backtrack.backtrackOrder[1].id).toBe('CP1');
      expect(backtrack.steps.length).toBe(1);
      expect(backtrack.steps[0].fromCheckpointId).toBe('CP3');
      expect(backtrack.steps[0].toCheckpointId).toBe('CP1');
    });

    it('gracefully handles empty or single checkpoint sequences', () => {
      const emptyBacktrack = generateBacktrackSequence([]);
      expect(emptyBacktrack.backtrackOrder.length).toBe(0);
      expect(emptyBacktrack.steps.length).toBe(0);

      const singleCp: Checkpoint[] = [
        { id: 'CP1', name: 'Trailhead', latitude: 13.1780, longitude: 75.2850, altitude: 820, sequenceNumber: 1, timestamp: '00:00', passed: true },
      ];
      const singleBacktrack = generateBacktrackSequence(singleCp);
      expect(singleBacktrack.backtrackOrder.length).toBe(1);
      expect(singleBacktrack.steps.length).toBe(0);
    });
  });
});
