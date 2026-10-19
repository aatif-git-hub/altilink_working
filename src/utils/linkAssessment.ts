import { LinkMeasurement, LinkAssessmentResult, TerrainType } from '../types';

/**
 * Adaptive LoRa Link Assessment Algorithm
 *
 * Periodic test packets determine RF link quality (RSSI, SNR, Packet Success Rate).
 * A deterministic boundary rule identifies the farthest distance meeting high reliability:
 * Rule: Packet Success >= 90% AND SNR >= 0 dB AND RSSI >= -90 dBm.
 *
 * Then applying the safety margin (default 20%):
 * Recommended Group Separation Threshold = Reliable Boundary * (1 - Safety Margin)
 */

export const TERRAIN_DATASETS: Record<TerrainType, { name: string; description: string; measurements: LinkMeasurement[] }> = {
  OPEN_TERRAIN: {
    name: 'Open Terrain / High Ridge',
    description: 'Line-of-sight conditions with minimal RF obstacles. Optimal propagation.',
    measurements: [
      { distance: 100, rssi: -58, snr: 10.5, packetSuccess: 100, ackReliability: 100, quality: 'EXCELLENT' },
      { distance: 200, rssi: -64, snr: 9.2, packetSuccess: 100, ackReliability: 100, quality: 'EXCELLENT' },
      { distance: 300, rssi: -70, snr: 8.0, packetSuccess: 99, ackReliability: 98, quality: 'GOOD' },
      { distance: 400, rssi: -75, snr: 6.8, packetSuccess: 98, ackReliability: 97, quality: 'GOOD' },
      { distance: 500, rssi: -81, snr: 4.5, packetSuccess: 95, ackReliability: 94, quality: 'GOOD' },
      { distance: 600, rssi: -87, snr: 1.8, packetSuccess: 91, ackReliability: 90, quality: 'GOOD' },
      { distance: 700, rssi: -93, snr: -2.0, packetSuccess: 74, ackReliability: 70, quality: 'POOR' },
      { distance: 800, rssi: -99, snr: -6.5, packetSuccess: 48, ackReliability: 42, quality: 'UNUSABLE' },
    ],
  },
  DENSE_FOREST: {
    name: 'Dense Forest / Canopy',
    description: 'High foliage absorption and multi-path scattering from tree trunks and moisture.',
    measurements: [
      { distance: 100, rssi: -65, snr: 9.0, packetSuccess: 100, ackReliability: 100, quality: 'EXCELLENT' },
      { distance: 200, rssi: -70, snr: 8.0, packetSuccess: 100, ackReliability: 99, quality: 'EXCELLENT' },
      { distance: 300, rssi: -76, snr: 7.0, packetSuccess: 98, ackReliability: 96, quality: 'GOOD' },
      { distance: 400, rssi: -82, snr: 5.0, packetSuccess: 95, ackReliability: 93, quality: 'GOOD' },
      { distance: 500, rssi: -88, snr: 2.0, packetSuccess: 82, ackReliability: 78, quality: 'FAIR' },
      { distance: 600, rssi: -94, snr: -1.0, packetSuccess: 55, ackReliability: 50, quality: 'POOR' },
      { distance: 700, rssi: -101, snr: -7.5, packetSuccess: 25, ackReliability: 20, quality: 'UNUSABLE' },
    ],
  },
  MOUNTAINOUS_TERRAIN: {
    name: 'Mountainous / Gorge / Ravine',
    description: 'Severe non-line-of-sight obstruction caused by granite ridges and steep elevation drop-offs.',
    measurements: [
      { distance: 100, rssi: -68, snr: 8.5, packetSuccess: 100, ackReliability: 100, quality: 'EXCELLENT' },
      { distance: 200, rssi: -75, snr: 6.8, packetSuccess: 98, ackReliability: 96, quality: 'GOOD' },
      { distance: 300, rssi: -83, snr: 3.5, packetSuccess: 92, ackReliability: 90, quality: 'GOOD' },
      { distance: 400, rssi: -91, snr: -0.5, packetSuccess: 68, ackReliability: 60, quality: 'POOR' },
      { distance: 500, rssi: -98, snr: -5.0, packetSuccess: 40, ackReliability: 35, quality: 'UNUSABLE' },
      { distance: 600, rssi: -106, snr: -11.0, packetSuccess: 12, ackReliability: 8, quality: 'UNUSABLE' },
    ],
  },
};

/**
 * Executes Link Assessment Algorithm
 */
export function evaluateLoRaLink(
  terrain: TerrainType = 'DENSE_FOREST',
  safetyMarginPercent: number = 20
): LinkAssessmentResult {
  const profile = TERRAIN_DATASETS[terrain] || TERRAIN_DATASETS.DENSE_FOREST;
  const measurements = profile.measurements;

  // Criteria for reliable threshold:
  // Packet Success >= 90% AND SNR >= 0.0 dB AND RSSI >= -90 dBm
  let reliableBoundary = 100;
  for (const m of measurements) {
    if (m.packetSuccess >= 90 && m.snr >= 0 && m.rssi >= -90) {
      if (m.distance > reliableBoundary) {
        reliableBoundary = m.distance;
      }
    }
  }

  const safetyFraction = safetyMarginPercent / 100;
  const recommendedGroupLimit = Math.round(reliableBoundary * (1 - safetyFraction));

  // Compute averages for summary cards
  const validMeasurements = measurements.filter((m) => m.distance <= reliableBoundary);
  const avgRssi = Math.round(
    validMeasurements.reduce((acc, curr) => acc + curr.rssi, 0) / validMeasurements.length
  );
  const avgSnr = Math.round(
    (validMeasurements.reduce((acc, curr) => acc + curr.snr, 0) / validMeasurements.length) * 10
  ) / 10;
  const avgPacketSuccess = Math.round(
    validMeasurements.reduce((acc, curr) => acc + curr.packetSuccess, 0) / validMeasurements.length
  );

  let overallQuality: 'EXCELLENT' | 'GOOD' | 'MARGINAL' | 'POOR' = 'GOOD';
  if (avgPacketSuccess >= 98 && avgSnr >= 8) overallQuality = 'EXCELLENT';
  else if (avgPacketSuccess >= 92 && avgSnr >= 3) overallQuality = 'GOOD';
  else if (avgPacketSuccess >= 80) overallQuality = 'MARGINAL';
  else overallQuality = 'POOR';

  return {
    lastEvaluatedAt: new Date().toLocaleTimeString(),
    terrain,
    reliableBoundary,
    safetyMarginPercent,
    recommendedGroupLimit,
    overallQuality,
    avgRssi,
    avgSnr,
    avgPacketSuccess,
    measurements,
  };
}
