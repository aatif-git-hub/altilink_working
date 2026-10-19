import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Member, Checkpoint, EmergencyPacket } from '../../types';

interface LeafletMapProps {
  members: Member[];
  checkpoints: Checkpoint[];
  separationThreshold: number;
  activeEmergency: EmergencyPacket | null;
  isBacktracking?: boolean;
  activeBacktrackIndex?: number;
  height?: string;
  interactive?: boolean;
  onSelectMember?: (member: Member) => void;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  members,
  checkpoints,
  separationThreshold,
  activeEmergency,
  isBacktracking = false,
  activeBacktrackIndex = 0,
  height = '100%',
  interactive = true,
  onSelectMember,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);

  // Determine center coordinates
  const leader = members.find((m) => m.isLeader) || members[0];
  const centerLat = leader ? leader.latitude : 13.0827;
  const centerLng = leader ? leader.longitude : 80.2707;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: 16,
        zoomControl: interactive,
        attributionControl: false,
        dragging: interactive,
        touchZoom: interactive,
        scrollWheelZoom: false,
      });

      // OpenStreetMap TileLayer with clean tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // Attribution control bottom-right
      if (interactive) {
        L.control.attribution({ position: 'bottomright' }).addTo(map);
      }

      const layerGroup = L.layerGroup().addTo(map);
      layersGroupRef.current = layerGroup;
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers, Trail & Separation Radius dynamically
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layersGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    // 1. Separation Radius Circle around Leader
    if (leader) {
      const circle = L.circle([leader.latitude, leader.longitude], {
        radius: separationThreshold,
        color: '#f59e0b',
        weight: 2,
        dashArray: '6, 6',
        fillColor: '#fef3c7',
        fillOpacity: 0.12,
      });
      circle.bindTooltip(`Safe Separation Radius: ${separationThreshold}m`, {
        permanent: false,
        direction: 'top',
        className: 'bg-slate-900 text-white font-mono text-xs px-2 py-1 rounded shadow-md border border-slate-700',
      });
      layerGroup.addLayer(circle);
    }

    // 2. Trail Polyline connecting recorded checkpoints
    if (checkpoints.length > 0) {
      const passedCps = checkpoints.filter((c) => c.passed).sort((a, b) => a.sequenceNumber - b.sequenceNumber);
      const trailCoords: L.LatLngExpression[] = passedCps.map((c) => [c.latitude, c.longitude]);

      if (trailCoords.length > 1) {
        const trailPolyline = L.polyline(trailCoords, {
          color: '#10b981',
          weight: 4,
          opacity: 0.85,
          lineJoin: 'round',
        });
        layerGroup.addLayer(trailPolyline);

        // If Backtracking is active, add highlighted reverse route
        if (isBacktracking) {
          const backtrackPolyline = L.polyline(trailCoords, {
            color: '#a855f7',
            weight: 5,
            dashArray: '8, 8',
            opacity: 0.95,
          });
          layerGroup.addLayer(backtrackPolyline);
        }
      }

      // Checkpoint Markers
      passedCps.forEach((cp) => {
        const isCurrentTarget = isBacktracking && checkpoints.length - 1 - activeBacktrackIndex === cp.sequenceNumber - 1;
        const iconHtml = `
          <div class="relative flex items-center justify-center">
            <div class="w-7 h-7 rounded-full ${isCurrentTarget ? 'bg-purple-600 ring-4 ring-purple-300 animate-bounce' : 'bg-emerald-700 border-2 border-emerald-300'} text-white text-[10px] font-bold font-mono flex items-center justify-center shadow-md">
              ${cp.id}
            </div>
            <div class="absolute -bottom-5 bg-slate-900/90 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap shadow-xs">
              ${cp.name}
            </div>
          </div>
        `;

        const cpIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-cp-marker',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([cp.latitude, cp.longitude], { icon: cpIcon });
        marker.bindPopup(`
          <div class="p-2 text-xs font-sans">
            <strong class="text-sm font-bold text-slate-900 block">${cp.name} (${cp.id})</strong>
            <span class="text-slate-500 block">Sequence: #${cp.sequenceNumber} • Time: ${cp.timestamp}</span>
            <span class="text-slate-600 block mt-1">Alt: ${cp.altitude}m • Lat: ${cp.latitude.toFixed(4)}, Lon: ${cp.longitude.toFixed(4)}</span>
            ${cp.notes ? `<p class="text-slate-700 italic mt-1">${cp.notes}</p>` : ''}
          </div>
        `);
        layerGroup.addLayer(marker);
      });
    }

    // 3. Member Markers
    members.forEach((m) => {
      const isSeparated = m.distance > separationThreshold;
      const isEmergent = activeEmergency && activeEmergency.senderID === m.id;

      const bgColor = isEmergent
        ? 'bg-red-600 ring-4 ring-red-400/80 animate-ping'
        : isSeparated
        ? 'bg-amber-500 ring-3 ring-amber-300'
        : m.isLeader
        ? 'bg-blue-600 ring-3 ring-blue-300'
        : 'bg-emerald-600 ring-2 ring-emerald-300';

      const iconHtml = `
        <div class="relative flex flex-col items-center justify-center cursor-pointer">
          <div class="w-8 h-8 rounded-full ${isEmergent ? 'bg-red-600 ring-4 ring-red-400' : bgColor} text-white font-bold font-mono text-xs flex items-center justify-center shadow-lg transition-transform hover:scale-110">
            ${m.id}
          </div>
          <div class="absolute -bottom-5 bg-slate-900/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm border border-slate-700 flex items-center gap-1">
            <span>${m.name}</span>
            ${m.isCurrentUser ? '<span class="text-emerald-400 font-normal">(You)</span>' : ''}
            <span class="text-slate-400 font-mono">(${m.distance}m)</span>
          </div>
        </div>
      `;

      const memberIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-member-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([m.latitude, m.longitude], { icon: memberIcon });
      marker.bindPopup(`
        <div class="p-2 text-xs font-sans space-y-1">
          <div class="flex items-center justify-between gap-2 border-b border-slate-200 pb-1">
            <strong class="text-sm font-bold text-slate-900">${m.name} (${m.id})</strong>
            <span class="font-bold text-[10px] px-1.5 py-0.5 rounded ${isEmergent ? 'bg-red-100 text-red-700' : isSeparated ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">
              ${isEmergent ? 'EMERGENCY' : isSeparated ? 'SEPARATED' : 'SAFE'}
            </span>
          </div>
          <div class="text-slate-600">
            <div>Distance from Leader: <strong class="text-slate-900 font-mono">${m.distance} m</strong></div>
            <div>GPS: <span class="font-mono">${m.latitude.toFixed(4)}, ${m.longitude.toFixed(4)}</span></div>
            <div>Status: <span class="font-semibold text-emerald-700">${m.connectionStatus}</span></div>
          </div>
        </div>
      `);

      if (onSelectMember) {
        marker.on('click', () => onSelectMember(m));
      }

      layerGroup.addLayer(marker);
    });

    // Auto-fit bounds if multiple points exist
    if (members.length > 1) {
      const allCoords: [number, number][] = members.map((m) => [m.latitude, m.longitude]);
      try {
        map.fitBounds(allCoords, { padding: [40, 40], maxZoom: 17 });
      } catch (e) {
        // Fallback gracefully
      }
    }
  }, [members, checkpoints, separationThreshold, activeEmergency, isBacktracking, activeBacktrackIndex]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-slate-900 border border-slate-200 shadow-inner" style={{ height }}>
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      
      {/* Map Attribution overlay */}
      <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-800 shadow-md border border-slate-200 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>OpenStreetMap Layer • WGS84 GPS</span>
      </div>
    </div>
  );
};
