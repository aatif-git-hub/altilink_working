import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Member, EmergencyPacket, TrailCatalogueItem } from '../../types';
import { calculateHaversineDistance } from '../../utils/haversine';
import { Compass, Locate } from 'lucide-react';
import clsx from 'clsx';

interface GroupGPSMiniMapProps {
  members: Member[];
  separationThreshold?: number;
  activeEmergency?: EmergencyPacket | null;
  selectedTrail?: TrailCatalogueItem | null;
}

// Helper to compute cardinal direction from currentUser to target member
function getRelativeBearing(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): string {
  const dLat = to.latitude - from.latitude;
  const dLon = to.longitude - from.longitude;

  if (Math.abs(dLat) < 0.00005 && Math.abs(dLon) < 0.00005) return 'At your location';

  const angleRad = Math.atan2(dLon, dLat);
  const angleDeg = (angleRad * (180 / Math.PI) + 360) % 360;

  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(angleDeg / 22.5) % 16;
  return `${directions[index]} (${Math.round(angleDeg)}°)`;
}

// Helper to format distance nicely (meters or km)
function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return 'Unavailable';
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${meters} m`;
}

export const GroupGPSMiniMap: React.FC<GroupGPSMiniMapProps> = ({
  members: allMembers,
  separationThreshold = 400,
  activeEmergency = null,
  selectedTrail,
}) => {
  const members = allMembers.filter(m => m.gpsValid !== false && Number.isFinite(m.latitude) && Number.isFinite(m.longitude));
  const hardwareData = allMembers.some(m => m.gpsValid !== undefined);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const currentUser = members.find((m) => m.isCurrentUser) || (!hardwareData ? members.find((m) => m.isLeader) || members[0] : undefined);
  const anchor = currentUser || members[0];
  const centerLat = anchor ? anchor.latitude : (selectedTrail?.trailheadCoords?.latitude || 13.1780);
  const centerLng = anchor ? anchor.longitude : (selectedTrail?.trailheadCoords?.longitude || 75.2850);

  // Initialize Local GPS Map centered on YOU (Local zoom 16 covering ~400m-600m proximity)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: 16, // Local proximity zoom
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: false,
      });

      // Topographic outdoor map layer
      const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        subdomains: 'abc',
        attribution: '&copy; OpenTopoMap',
      });
      topoLayer.addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      layerGroupRef.current = layerGroup;
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers and Proximity Range Circle centered around YOU
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;
    layerGroup.clearLayers();
    if (!anchor) return;

    // 1. Safe Separation Boundary Circle around YOU (Local safety radius reference)
    if (currentUser && Number.isFinite(separationThreshold)) {
    const safetyCircle = L.circle([currentUser.latitude, currentUser.longitude], {
      radius: separationThreshold,
      color: '#059669',
      weight: 1.5,
      dashArray: '5, 5',
      fillColor: '#10b981',
      fillOpacity: 0.06,
    });
    layerGroup.addLayer(safetyCircle);
    }

    // 2. Anti-collision grouping for nearby members
    const coordinateGroups: { [key: string]: Member[] } = {};
    members.forEach((m) => {
      const key = `${m.latitude.toFixed(3.5)}_${m.longitude.toFixed(3.5)}`;
      if (!coordinateGroups[key]) coordinateGroups[key] = [];
      coordinateGroups[key].push(m);
    });

    // 3. Render YOU and connected group members
    members.forEach((m) => {
      const isYou = m.isCurrentUser;
      const isEmergent = activeEmergency && activeEmergency.senderID === m.id;

      let displayLat = m.latitude;
      let displayLng = m.longitude;

      const groupKey = `${m.latitude.toFixed(3.5)}_${m.longitude.toFixed(3.5)}`;
      const nearMembers = coordinateGroups[groupKey] || [m];
      if (m.gpsValid === undefined && nearMembers.length > 1) {
        const idxInGroup = nearMembers.findIndex((item) => item.id === m.id);
        if (idxInGroup > 0) {
          const angle = (idxInGroup * 2 * Math.PI) / nearMembers.length;
          const radiusDeg = 0.0003;
          displayLat += Math.sin(angle) * radiusDeg;
          displayLng += Math.cos(angle) * radiusDeg;
        }
      }

      const distFromYou = !currentUser ? NaN : isYou
        ? 0
        : Math.round(
            calculateHaversineDistance(
              { latitude: currentUser.latitude, longitude: currentUser.longitude },
              { latitude: m.latitude, longitude: m.longitude }
            )
          );

      const iconHtml = `
        <div class="relative flex flex-col items-center justify-center">
          <div class="w-7 h-7 rounded-full ${
            isEmergent
              ? 'bg-red-600 ring-4 ring-red-400 animate-ping'
              : isYou
              ? 'bg-slate-900 ring-3 ring-amber-400'
              : m.isLeader
              ? 'bg-blue-600 ring-2 ring-blue-300'
              : 'bg-emerald-600 ring-2 ring-emerald-300'
          } text-white font-bold font-mono text-[11px] flex items-center justify-center shadow-md">
            ${m.id}
          </div>
          <div class="absolute -bottom-4 bg-slate-900/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap shadow-xs pointer-events-none">
            ${isYou ? 'YOU' : `${m.name} (${formatDistance(distFromYou)})`}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        html: iconHtml,
        className: 'gps-mini-marker',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([displayLat, displayLng], { icon });
      marker.bindPopup(`
        <div class="p-1.5 text-xs font-sans">
          <strong class="font-bold text-slate-900 block">${isYou ? 'YOU (' + m.name + ')' : m.name} (${m.id})</strong>
          <span class="text-slate-500 block">${isYou ? 'Your GPS position' : `Distance from you: ${formatDistance(distFromYou)}`}</span>
          <span class="text-slate-600 font-mono block mt-0.5">${m.latitude.toFixed(4)}, ${m.longitude.toFixed(4)}</span>
        </div>
      `);
      layerGroup.addLayer(marker);
    });

    // 4. IMPORTANT: KEEP LOCAL GPS VIEW ALWAYS CENTERED ON YOU AT LOCAL ZOOM (DO NOT FIT ALL DISTANT MEMBERS)
    map.setView([anchor.latitude, anchor.longitude], 16, { animate: false });
  }, [members, separationThreshold, activeEmergency, currentUser]);

  const handleCenterOnMe = () => {
    if (mapInstanceRef.current && currentUser) {
      mapInstanceRef.current.setView([currentUser.latitude, currentUser.longitude], 16, { animate: true });
    }
  };

  const otherMembers = members.filter((m) => !m.isCurrentUser);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-slate-100 text-slate-800">
            <Compass className="w-4 h-4 text-slate-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 leading-tight">
              GROUP GPS MINI-MAP
            </h3>
            <p className="text-xs text-slate-500">
              Where are the other group members relative to you right now?
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
            {hardwareData ? 'Suggested limit' : 'Safe radius'}: {formatDistance(separationThreshold)}
          </span>
          <button
            onClick={handleCenterOnMe}
            disabled={!currentUser}
            title="Recenter on YOU"
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors flex items-center gap-1 text-xs font-semibold"
          >
            <Locate className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Center on YOU</span>
          </button>
        </div>
      </div>

      {/* Map + Relative Positions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Compact GPS Leaflet Canvas (200px height, centered strictly on YOU) */}
        <div className="md:col-span-7 w-full h-[200px] rounded-xl overflow-hidden border border-slate-200 shadow-inner relative">
          <div ref={mapContainerRef} className="w-full h-full z-0" />
          <div className="absolute bottom-2 left-2 z-[400] bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] font-semibold text-slate-700 border border-slate-200 shadow-xs">
            {currentUser ? 'Local positions • Centered on you' : 'Your GPS unavailable • Received locations only'}
          </div>
        </div>

        {/* Relative Spatial Positioning List */}
        <div className="md:col-span-5 space-y-2 h-[200px] overflow-y-auto pr-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Spatial Overview Relative to YOU:
          </span>

          {/* YOU Indicator */}
          <div className="p-2.5 rounded-xl border border-slate-300 bg-slate-50 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-slate-900 text-white ring-1 ring-amber-400 font-bold font-mono text-[11px] flex items-center justify-center">
                {currentUser?.id || 'YOU'}
              </span>
              <div>
                <span className="font-bold text-slate-900 block leading-tight">
                  YOU ({currentUser?.name || 'Current User'})
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {currentUser ? `${currentUser.latitude.toFixed(4)}, ${currentUser.longitude.toFixed(4)}` : 'Waiting for a fresh GPS fix'}
                </span>
              </div>
            </div>
            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              Center
            </span>
          </div>

          {/* Other Connected Members */}
          {otherMembers.length === 0 ? (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
              No other group members connected yet.
            </div>
          ) : (
            otherMembers.map((m) => {
              const isEmergent = activeEmergency && activeEmergency.senderID === m.id;
              const distFromYou = currentUser
                ? Math.round(
                    calculateHaversineDistance(
                      { latitude: currentUser.latitude, longitude: currentUser.longitude },
                      { latitude: m.latitude, longitude: m.longitude }
                    )
                  )
                : m.distance;

              const bearing = currentUser
                ? getRelativeBearing(
                    { latitude: currentUser.latitude, longitude: currentUser.longitude },
                    { latitude: m.latitude, longitude: m.longitude }
                  )
                : 'Unavailable';

              const isOutOfRange = !hardwareData && distFromYou > 1200; // Far out of local mesh
              const isSeparated = distFromYou > separationThreshold;

              return (
                <div
                  key={m.id}
                  className={clsx(
                    'p-2.5 rounded-xl border text-xs flex items-center justify-between transition-colors',
                    isEmergent
                      ? 'border-red-300 bg-red-50'
                      : isOutOfRange
                      ? 'border-slate-200 bg-slate-50'
                      : isSeparated
                      ? 'border-amber-300 bg-amber-50/70'
                      : 'border-slate-200 bg-white'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        'w-6 h-6 rounded-md font-bold font-mono text-[11px] flex items-center justify-center',
                        isEmergent
                          ? 'bg-red-600 text-white'
                          : isOutOfRange
                          ? 'bg-slate-400 text-white'
                          : m.isLeader
                          ? 'bg-blue-600 text-white'
                          : 'bg-emerald-600 text-white'
                      )}
                    >
                      {m.id}
                    </span>
                    <div>
                      <span className="font-bold text-slate-900 block leading-tight">
                        {m.name}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Bearing: <strong className="text-slate-700 font-sans">{bearing}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="text-right text-[11px]">
                    <span
                      className={clsx(
                        'font-mono font-bold block',
                        isOutOfRange
                          ? 'text-slate-600'
                          : isSeparated
                          ? 'text-amber-700'
                          : 'text-slate-800'
                      )}
                    >
                      {formatDistance(distFromYou)}
                    </span>
                    <span
                      className={clsx(
                        'text-[10px] font-semibold',
                        isEmergent
                          ? 'text-red-700'
                          : isOutOfRange
                          ? 'text-slate-500 uppercase'
                          : isSeparated
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      )}
                    >
                      {isEmergent ? 'Emergency' : !Number.isFinite(separationThreshold) || !Number.isFinite(distFromYou) ? 'Limit unknown' : isOutOfRange ? 'Out of Range' : isSeparated ? 'Warning' : 'In Range'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
