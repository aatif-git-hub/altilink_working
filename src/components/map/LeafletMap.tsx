import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Member, Checkpoint, EmergencyPacket, TrailCatalogueItem } from '../../types';
import { Locate, Maximize2, Layers } from 'lucide-react';

interface LeafletMapProps {
  members: Member[];
  checkpoints: Checkpoint[];
  selectedTrail?: TrailCatalogueItem | null;
  separationThreshold?: number;
  activeEmergency?: EmergencyPacket | null;
  isBacktracking?: boolean;
  activeBacktrackIndex?: number;
  height?: string;
  interactive?: boolean;
  mode?: 'MINI' | 'FULL';
  onSelectMember?: (member: Member) => void;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  members: allMembers,
  checkpoints,
  selectedTrail,
  separationThreshold = 400,
  activeEmergency = null,
  isBacktracking = false,
  activeBacktrackIndex = 0,
  height = '100%',
  interactive = true,
  mode = 'FULL',
  onSelectMember,
}) => {
  const members = allMembers.filter(m => m.gpsValid !== false && Number.isFinite(m.latitude) && Number.isFinite(m.longitude));
  const hardwareData = allMembers.some(m => m.gpsValid !== undefined);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);
  const [mapLayerType, setMapLayerType] = useState<'TOPO' | 'OUTDOORS'>('TOPO');
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);

  const currentUser = members.find((m) => m.isCurrentUser) || (!hardwareData ? members.find((m) => m.isLeader) || members[0] : undefined);
  const centerLat = selectedTrail?.trailheadCoords?.latitude || (currentUser ? currentUser.latitude : 13.1780);
  const centerLng = selectedTrail?.trailheadCoords?.longitude || (currentUser ? currentUser.longitude : 75.2850);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: mode === 'MINI' ? 14 : 15,
        zoomControl: false,
        attributionControl: false,
        dragging: interactive,
        touchZoom: interactive,
        scrollWheelZoom: false,
      });

      if (interactive && mode === 'FULL') {
        L.control.zoom({ position: 'topright' }).addTo(map);
      }

      // Topographic & Outdoors Tile Layer (Focus on natural terrain, elevation contours, forests, ridges)
      const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        subdomains: 'abc',
        attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Style: &copy; OpenTopoMap',
      });

      topoLayer.addTo(map);
      baseTileLayerRef.current = topoLayer;

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

  // Center on current user
  const handleCenterOnMe = () => {
    if (mapInstanceRef.current && currentUser) {
      mapInstanceRef.current.setView([currentUser.latitude, currentUser.longitude], 15, { animate: true });
    }
  };

  // Fit all trail elements and members
  const handleFitRoute = () => {
    if (!mapInstanceRef.current) return;
    const points: [number, number][] = [];

    if (selectedTrail?.routeCoordinates) {
      selectedTrail.routeCoordinates.forEach((c) => points.push([c[0], c[1]]));
    }
    members.forEach((m) => points.push([m.latitude, m.longitude]));
    checkpoints.forEach((cp) => points.push([cp.latitude, cp.longitude]));

    if (points.length > 0) {
      try {
        mapInstanceRef.current.fitBounds(points, { padding: [40, 40], maxZoom: 16, animate: true });
      } catch (e) {
        // Ignored
      }
    }
  };

  // Toggle Map Layer between OpenTopoMap and Standard Outdoors
  const handleToggleLayer = () => {
    if (!mapInstanceRef.current) return;
    const newType = mapLayerType === 'TOPO' ? 'OUTDOORS' : 'TOPO';
    setMapLayerType(newType);

    if (baseTileLayerRef.current) {
      mapInstanceRef.current.removeLayer(baseTileLayerRef.current);
    }

    const url =
      newType === 'TOPO'
        ? 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const newLayer = L.tileLayer(url, {
      maxZoom: 18,
      attribution: newType === 'TOPO' ? '&copy; OpenTopoMap' : '&copy; OpenStreetMap contributors',
    }).addTo(mapInstanceRef.current);

    baseTileLayerRef.current = newLayer;
  };

  // Update Trail, Checkpoints, and Member Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layersGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    // 1. Draw Predefined Trail Route if present (Existing Trek in Western Ghats)
    if (selectedTrail?.routeCoordinates && selectedTrail.routeCoordinates.length > 1) {
      const trailCoords: L.LatLngExpression[] = selectedTrail.routeCoordinates.map((c) => [c[0], c[1]]);

      // Outer casing for contrast against terrain
      const trailCasing = L.polyline(trailCoords, {
        color: '#ffffff',
        weight: 6,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      });
      layerGroup.addLayer(trailCasing);

      // Main hiking route line
      const trailPolyline = L.polyline(trailCoords, {
        color: '#059669', // Rich Forest Emerald
        weight: 4,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      });
      layerGroup.addLayer(trailPolyline);

      // Start / Trailhead Marker
      const startCoord = selectedTrail.routeCoordinates[0];
      const startHtml = `
        <div class="relative flex items-center justify-center">
          <div class="px-2 py-0.5 rounded-full bg-emerald-700 text-white text-[10px] font-black tracking-wider uppercase border-2 border-white shadow-md flex items-center gap-1">
            <span>START</span>
          </div>
        </div>
      `;
      const startIcon = L.divIcon({ html: startHtml, className: 'trail-start-marker', iconSize: [50, 20], iconAnchor: [25, 10] });
      const startMarker = L.marker([startCoord[0], startCoord[1]], { icon: startIcon });
      startMarker.bindPopup(`<strong>Trailhead (Start):</strong> ${selectedTrail.name}`);
      layerGroup.addLayer(startMarker);

      // End / Summit Marker
      if (selectedTrail.routeCoordinates.length > 2) {
        const endCoord = selectedTrail.routeCoordinates[selectedTrail.routeCoordinates.length - 1];
        const endHtml = `
          <div class="relative flex items-center justify-center">
            <div class="px-2 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-black tracking-wider uppercase border-2 border-white shadow-md flex items-center gap-1">
              <span>END</span>
            </div>
          </div>
        `;
        const endIcon = L.divIcon({ html: endHtml, className: 'trail-end-marker', iconSize: [46, 20], iconAnchor: [23, 10] });
        const endMarker = L.marker([endCoord[0], endCoord[1]], { icon: endIcon });
        endMarker.bindPopup(`<strong>Summit / Destination (End):</strong> ${selectedTrail.name}`);
        layerGroup.addLayer(endMarker);
      }
    }

    // 2. Trail Polyline connecting recorded dynamic checkpoints
    if (checkpoints && checkpoints.length > 0) {
      const passedCps = checkpoints.filter((c) => c.passed).sort((a, b) => a.sequenceNumber - b.sequenceNumber);
      const cpCoords: L.LatLngExpression[] = passedCps.map((c) => [c.latitude, c.longitude]);

      if (cpCoords.length > 1 && (!selectedTrail || !selectedTrail.routeCoordinates)) {
        // Connect recorded checkpoints for custom trek
        const customTrailPolyline = L.polyline(cpCoords, {
          color: '#2563eb',
          weight: 4,
          dashArray: '4, 4',
          opacity: 0.9,
          lineJoin: 'round',
        });
        layerGroup.addLayer(customTrailPolyline);
      }

      // If Backtracking is active, add highlighted reverse route
      if (isBacktracking && cpCoords.length > 1) {
        const backtrackPolyline = L.polyline(cpCoords, {
          color: '#9333ea', // Vivid Purple
          weight: 5,
          dashArray: '8, 8',
          opacity: 0.95,
        });
        layerGroup.addLayer(backtrackPolyline);
      }

      // Checkpoint Markers
      passedCps.forEach((cp) => {
        const isCurrentTarget =
          isBacktracking && checkpoints.length - 1 - activeBacktrackIndex === cp.sequenceNumber - 1;

        const iconHtml = `
          <div class="relative flex flex-col items-center justify-center">
            <div class="w-6 h-6 rounded-full ${
              isCurrentTarget
                ? 'bg-purple-600 ring-4 ring-purple-300 animate-bounce'
                : 'bg-emerald-800 border-2 border-white'
            } text-white text-[10px] font-black font-mono flex items-center justify-center shadow-md">
              ${cp.id}
            </div>
            <div class="absolute -bottom-4 bg-slate-900/90 text-white text-[9px] font-semibold px-1 rounded whitespace-nowrap shadow-xs pointer-events-none">
              ${cp.name}
            </div>
          </div>
        `;

        const cpIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-cp-marker',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([cp.latitude, cp.longitude], { icon: cpIcon });
        marker.bindPopup(`
          <div class="p-1.5 text-xs font-sans">
            <strong class="font-bold text-slate-900 block">${cp.name} (${cp.id})</strong>
            <span class="text-slate-500 block">Sequence: #${cp.sequenceNumber} • Time: ${cp.timestamp}</span>
            <span class="text-slate-600 block mt-0.5">Alt: ${cp.altitude}m</span>
          </div>
        `);
        layerGroup.addLayer(marker);
      });
    }

    // 3. Connected Member Markers with Anti-Collision Offset
    // Group members by near-identical coordinates to apply visual spiderfy offset
    const coordinateGroups: { [key: string]: Member[] } = {};
    members.forEach((m) => {
      // Quantize to ~30 meters grid to detect close proximity
      const key = `${m.latitude.toFixed(3.5)}_${m.longitude.toFixed(3.5)}`;
      if (!coordinateGroups[key]) coordinateGroups[key] = [];
      coordinateGroups[key].push(m);
    });

    members.forEach((m) => {
      const isEmergent = activeEmergency && activeEmergency.senderID === m.id;
      const isYou = m.isCurrentUser;

      // Calculate anti-collision offset if multiple members share close coordinates
      let displayLat = m.latitude;
      let displayLng = m.longitude;

      const groupKey = `${m.latitude.toFixed(3.5)}_${m.longitude.toFixed(3.5)}`;
      const nearMembers = coordinateGroups[groupKey] || [m];
      if (m.gpsValid === undefined && nearMembers.length > 1) {
        const idxInGroup = nearMembers.findIndex((item) => item.id === m.id);
        if (idxInGroup > 0) {
          const angle = (idxInGroup * 2 * Math.PI) / nearMembers.length;
          const radiusDeg = 0.00035; // ~35m visual separation
          displayLat += Math.sin(angle) * radiusDeg;
          displayLng += Math.cos(angle) * radiusDeg;
        }
      }

      // Marker badge
      const iconHtml = `
        <div class="relative flex flex-col items-center justify-center cursor-pointer">
          <div class="w-8 h-8 rounded-full ${
            isEmergent
              ? 'bg-red-600 ring-4 ring-red-400 animate-ping'
              : isYou
              ? 'bg-slate-900 ring-3 ring-amber-400'
              : m.isLeader
              ? 'bg-blue-600 ring-2 ring-blue-300'
              : 'bg-emerald-600 ring-2 ring-emerald-300'
          } text-white font-bold font-mono text-xs flex items-center justify-center shadow-lg transition-transform hover:scale-110">
            ${m.id}
          </div>
          <div class="absolute -bottom-5 bg-slate-900/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm border border-slate-700 flex items-center gap-1">
            ${isYou ? '<span class="text-amber-300 font-black">YOU • </span>' : ''}
            <span>${m.name}</span>
          </div>
        </div>
      `;

      const memberIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-member-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([displayLat, displayLng], { icon: memberIcon });
      marker.bindPopup(`
        <div class="p-2 text-xs font-sans space-y-1">
          <div class="flex items-center justify-between gap-2 border-b border-slate-200 pb-1">
            <strong class="text-sm font-bold text-slate-900">
              ${isYou ? 'YOU (' + m.name + ')' : m.name} (${m.id})
            </strong>
            <span class="font-bold text-[10px] px-1.5 py-0.5 rounded ${
              isEmergent ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
            }">
              ${isEmergent ? 'EMERGENCY' : 'SAFE'}
            </span>
          </div>
          <div class="text-slate-600">
            <div>Role: <strong class="text-slate-900">${m.isLeader ? 'Group Leader' : 'Trekker'}</strong></div>
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

    // Auto-fit on initial render or member/trail change
    const pointsToFit: [number, number][] = [];
    if (selectedTrail?.routeCoordinates && selectedTrail.routeCoordinates.length > 0) {
      selectedTrail.routeCoordinates.forEach((c) => pointsToFit.push([c[0], c[1]]));
    }
    members.forEach((m) => pointsToFit.push([m.latitude, m.longitude]));
    checkpoints.forEach((cp) => pointsToFit.push([cp.latitude, cp.longitude]));

    if (pointsToFit.length > 0) {
      try {
        map.fitBounds(pointsToFit, { padding: [30, 30], maxZoom: mode === 'MINI' ? 14 : 16 });
      } catch (e) {
        // Ignored
      }
    }
  }, [members, checkpoints, selectedTrail, activeEmergency, isBacktracking, activeBacktrackIndex, mode]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-slate-900 border border-slate-200 shadow-inner" style={{ height }}>
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Map Interactive Controls (Top Right) */}
      {interactive && mode === 'FULL' && (
        <div className="absolute top-3 right-3 z-[400] flex flex-col gap-2">
          <button
            onClick={handleCenterOnMe}
            disabled={!currentUser}
            title="Center on My Location"
            className="p-2 bg-white/95 hover:bg-white text-slate-800 rounded-lg shadow-md border border-slate-200 transition-colors flex items-center justify-center"
          >
            <Locate className="w-4 h-4 text-slate-700" />
          </button>

          <button
            onClick={handleFitRoute}
            title="Fit Trail & Members in View"
            className="p-2 bg-white/95 hover:bg-white text-slate-800 rounded-lg shadow-md border border-slate-200 transition-colors flex items-center justify-center"
          >
            <Maximize2 className="w-4 h-4 text-slate-700" />
          </button>

          <button
            onClick={handleToggleLayer}
            title="Toggle Topographic / Standard Layer"
            className="p-2 bg-white/95 hover:bg-white text-slate-800 rounded-lg shadow-md border border-slate-200 transition-colors flex items-center justify-center text-xs font-bold"
          >
            <Layers className="w-4 h-4 text-slate-700" />
          </button>
        </div>
      )}

      {/* Map Attribution overlay (Bottom Left) */}
      <div className="absolute bottom-2.5 left-2.5 z-[400] bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[10px] font-semibold text-slate-800 shadow-md border border-slate-200 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>{mapLayerType === 'TOPO' ? 'OpenTopoMap Terrain' : 'Outdoor Map'}</span>
      </div>
    </div>
  );
};
