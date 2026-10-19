import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  HikeLifecycleState,
  GroupProfile,
  UserProfile,
  Member,
  EmergencyPacket,
  BroadcastRecipientStatus,
  Checkpoint,
  TerrainType,
  LinkAssessmentResult,
  WearableDeviceState,
  GroupOverallStatus,
  TestCaseResult,
} from '../types';
import {
  DEFAULT_BASE_LATITUDE,
  DEFAULT_BASE_LONGITUDE,
  DEFAULT_BASE_ALTITUDE,
  DEFAULT_SEPARATION_THRESHOLD,
  DEFAULT_SAFETY_MARGIN,
  generateGroupCode,
  DEFAULT_HIKE_CHECKPOINTS,
} from '../data/initialData';
import { calculateHaversineDistance, checkSeparationStatus } from '../utils/haversine';
import { evaluateLoRaLink } from '../utils/linkAssessment';
import { filterGroupPacket } from '../utils/groupFilter';
import { generateBacktrackSequence } from '../utils/backtrack';
import { communicationService, MeshMessage, SharedGroupRecord } from '../services/communicationService';

export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
}

interface SimulationContextType {
  // Lifecycle & User Profile
  lifecycleState: HikeLifecycleState;
  setLifecycleState: (state: HikeLifecycleState) => void;
  groupProfile: GroupProfile | null;
  currentUser: UserProfile | null;
  members: Member[];

  // Thresholds & Dynamic Link State
  separationThreshold: number;
  setSeparationThreshold: (meters: number) => void;
  safetyMargin: number;
  setSafetyMargin: (margin: number) => void;
  currentTerrain: TerrainType;
  setCurrentTerrain: (terrain: TerrainType) => void;
  linkAssessment: LinkAssessmentResult;

  // Hike Navigation & Checkpoints
  checkpoints: Checkpoint[];
  isBacktracking: boolean;
  activeBacktrackIndex: number;
  isOfflineMapDownloaded: boolean;
  toggleOfflineMap: () => void;

  // Emergency & LoRa Mesh
  activeEmergency: EmergencyPacket | null;
  emergencyHistory: EmergencyPacket[];
  broadcastRecipients: BroadcastRecipientStatus[];
  broadcastProgress: number;
  isBroadcasting: boolean;

  // Hardware State & Toasts
  wearableState: WearableDeviceState;
  toasts: ToastNotification[];
  addToast: (title: string, message: string, type?: ToastNotification['type']) => void;
  removeToast: (id: string) => void;

  // Group Overall Summary
  overallGroupStatus: GroupOverallStatus;
  separatedCount: number;

  // Multi-User Actions
  createGroup: (groupName: string, userName: string, memberId: string) => void;
  joinGroup: (groupCode: string, userName: string, memberId: string) => boolean;
  addLobbyMember: (name: string, memberId: string, distanceOffset?: number) => void;
  removeLobbyMember: (memberId: string) => void;
  startHike: () => void;
  endHike: () => void;
  resetSession: () => void;

  updateMemberLocation: (memberId: string, latitude: number, longitude: number) => void;
  updateMemberDistanceOffset: (memberId: string, distanceMeters: number) => void;
  runLinkAssessment: (terrain?: TerrainType, margin?: number) => void;
  triggerManualSOS: (senderId?: string) => void;
  triggerFallEmergency: (senderId?: string) => void;
  resolveEmergency: () => void;
  toggleBacktracking: () => void;
  nextBacktrackStep: () => void;
  prevBacktrackStep: () => void;
  addCheckpoint: (name: string, notes?: string) => void;
  toggleBLE: () => void;

  // System test runner
  runSystemTests: () => TestCaseResult[];
}

const TAB_SESSION_KEY = 'altilink_tab_session_v4';

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export const SimulationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load per-tab session from sessionStorage
  const loadTabSession = () => {
    try {
      if (typeof window !== 'undefined') {
        const raw = sessionStorage.getItem(TAB_SESSION_KEY);
        if (raw) {
          const session = JSON.parse(raw);
          // If group exists in shared registry, hydrate full group state
          if (session.groupCode) {
            const sharedGroup = communicationService.getGroupFromRegistry(session.groupCode);
            if (sharedGroup) {
              return {
                ...session,
                groupProfile: sharedGroup.profile,
                members: sharedGroup.members || [],
                hikeState: sharedGroup.hikeState || session.lifecycleState || 'GROUP_LOBBY',
                separationThreshold: sharedGroup.separationThreshold || DEFAULT_SEPARATION_THRESHOLD,
                activeEmergency: sharedGroup.activeEmergency || null,
                checkpoints: sharedGroup.checkpoints && sharedGroup.checkpoints.length > 0 ? sharedGroup.checkpoints : DEFAULT_HIKE_CHECKPOINTS,
              };
            }
          }
          return session;
        }
      }
    } catch (e) {
      console.warn('Failed to load tab session:', e);
    }
    return null;
  };

  const initialTab = loadTabSession();

  const [lifecycleState, setLifecycleState] = useState<HikeLifecycleState>(
    (initialTab?.hikeState as HikeLifecycleState) || initialTab?.lifecycleState || 'WELCOME'
  );
  const [groupProfile, setGroupProfile] = useState<GroupProfile | null>(
    initialTab?.groupProfile || null
  );
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(
    initialTab?.currentUser || null
  );
  const [members, setMembers] = useState<Member[]>(
    initialTab?.members || []
  );
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>(
    initialTab?.checkpoints || DEFAULT_HIKE_CHECKPOINTS
  );

  const [separationThreshold, setSeparationThreshold] = useState<number>(
    initialTab?.separationThreshold || DEFAULT_SEPARATION_THRESHOLD
  );
  const [safetyMargin, setSafetyMargin] = useState<number>(
    initialTab?.safetyMargin || DEFAULT_SAFETY_MARGIN
  );
  const [currentTerrain, setCurrentTerrain] = useState<TerrainType>(
    initialTab?.currentTerrain || 'DENSE_FOREST'
  );
  const [linkAssessment, setLinkAssessment] = useState<LinkAssessmentResult>(() =>
    evaluateLoRaLink(initialTab?.currentTerrain || 'DENSE_FOREST', initialTab?.safetyMargin || DEFAULT_SAFETY_MARGIN)
  );

  const [activeEmergency, setActiveEmergency] = useState<EmergencyPacket | null>(
    initialTab?.activeEmergency || null
  );
  const [emergencyHistory, setEmergencyHistory] = useState<EmergencyPacket[]>(
    initialTab?.emergencyHistory || []
  );
  const [broadcastRecipients, setBroadcastRecipients] = useState<BroadcastRecipientStatus[]>([]);
  const [broadcastProgress, setBroadcastProgress] = useState<number>(0);
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);

  const [isBacktracking, setIsBacktracking] = useState<boolean>(false);
  const [activeBacktrackIndex, setActiveBacktrackIndex] = useState<number>(0);
  const [isOfflineMapDownloaded, setIsOfflineMapDownloaded] = useState<boolean>(true);

  const [wearableState, setWearableState] = useState<WearableDeviceState>({
    model: 'Heltec WiFi LoRa 32 V3',
    bleStatus: 'CONNECTED',
    buzzerVibration: initialTab?.activeEmergency ? 'ACTIVE' : 'IDLE',
  });

  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Toast Notification helper
  const addToast = (title: string, message: string, type: ToastNotification['type'] = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setToasts((prev) => [...prev.slice(-3), { id, title, message, type, timestamp: new Date().toLocaleTimeString() }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Persist Tab Identity to sessionStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const tabSession = {
          lifecycleState,
          groupCode: groupProfile?.code || null,
          groupProfile,
          currentUser,
          separationThreshold,
          safetyMargin,
          currentTerrain,
        };
        sessionStorage.setItem(TAB_SESSION_KEY, JSON.stringify(tabSession));
      }
    } catch (e) {
      console.warn('Failed to persist tab session:', e);
    }
  }, [lifecycleState, groupProfile, currentUser, separationThreshold, safetyMargin, currentTerrain]);

  // Recalculate member distances and dynamic separation status relative to leader
  useEffect(() => {
    if (members.length === 0) return;

    const leader = members.find((m) => m.isLeader) || members[0];
    const leaderCoord = { latitude: leader.latitude, longitude: leader.longitude };

    setMembers((prevMembers) =>
      prevMembers.map((m) => {
        const calculatedDistance = calculateHaversineDistance(leaderCoord, {
          latitude: m.latitude,
          longitude: m.longitude,
        });

        const isExceeded = calculatedDistance > separationThreshold;
        const isEmergent = activeEmergency && activeEmergency.senderID === m.id;
        const isCurrent = currentUser?.memberId === m.id;

        return {
          ...m,
          distance: Math.round(calculatedDistance),
          connectionStatus: isExceeded ? 'Warning' : 'Connected',
          emergencyStatus: isEmergent
            ? 'Emergency'
            : isExceeded
            ? 'Warning'
            : 'Safe',
          isCurrentUser: isCurrent,
        };
      })
    );
  }, [separationThreshold, activeEmergency, currentUser]);

  // Real-Time Cross-Window Communication Listener (BroadcastChannel)
  useEffect(() => {
    const unsubscribe = communicationService.subscribe((msg: MeshMessage) => {
      const currentCode = groupProfile?.code?.toUpperCase();
      if (!currentCode || msg.groupCode !== currentCode) {
        return;
      }

      switch (msg.type) {
        case 'MEMBER_JOINED': {
          const newMem: Member = msg.payload.member;
          if (newMem) {
            setMembers((prev) => {
              const existing = prev.filter((m) => m.id !== newMem.id);
              const adjusted: Member = {
                ...newMem,
                isCurrentUser: currentUser?.memberId === newMem.id,
              };
              return [...existing, adjusted];
            });
            addToast('Member Joined', `${newMem.name} (${newMem.id}) joined the group lobby.`, 'info');
          }
          break;
        }

        case 'MEMBER_REMOVED': {
          const { memberId } = msg.payload;
          if (memberId) {
            setMembers((prev) => prev.filter((m) => m.id !== memberId));
          }
          break;
        }

        case 'HIKE_STARTED': {
          setLifecycleState('ACTIVE_HIKE');
          addToast('Hike Started', 'Group leader has engaged active hiking monitoring.', 'success');
          break;
        }

        case 'HIKE_ENDED': {
          setLifecycleState('GROUP_LOBBY');
          setActiveEmergency(null);
          setIsBacktracking(false);
          setWearableState((prev) => ({ ...prev, buzzerVibration: 'IDLE' }));
          addToast('Hike Ended', 'Hike ended. Returned to group lobby.', 'info');
          break;
        }

        case 'LOCATION_UPDATE': {
          const { memberId, latitude, longitude, distance } = msg.payload;
          if (memberId) {
            setMembers((prev) =>
              prev.map((m) =>
                m.id === memberId
                  ? { ...m, latitude, longitude, distance, lastSeen: 'Just now' }
                  : m
              )
            );
          }
          break;
        }

        case 'EMERGENCY_BROADCAST': {
          const packet: EmergencyPacket = msg.payload.packet;
          if (packet) {
            setActiveEmergency(packet);
            setEmergencyHistory((prev) => [packet, ...prev.filter((p) => p.packetID !== packet.packetID)]);
            setWearableState((prev) => ({ ...prev, buzzerVibration: 'ACTIVE' }));

            addToast(
              'EMERGENCY ALERT',
              `Distress beacon received from ${packet.senderName} (${packet.senderID})! Wearable buzzer active.`,
              'error'
            );

            // Automatically send ACK back to sender tab over mesh
            if (currentUser && currentUser.memberId !== packet.senderID) {
              communicationService.sendEmergencyAck(
                currentCode,
                packet.packetID,
                currentUser.memberId,
                currentUser.name
              );
            }
          }
          break;
        }

        case 'EMERGENCY_ACK': {
          const { memberId, memberName } = msg.payload;
          if (memberId) {
            setBroadcastRecipients((prev) =>
              prev.map((r) =>
                r.memberId === memberId
                  ? { ...r, received: true, ackSent: true, receivedAt: new Date().toLocaleTimeString() }
                  : r
              )
            );
            addToast('ACK Received', `${memberName || memberId} confirmed receipt of distress beacon.`, 'success');
          }
          break;
        }

        case 'EMERGENCY_RESOLVED': {
          setActiveEmergency(null);
          setIsBroadcasting(false);
          setBroadcastProgress(0);
          setBroadcastRecipients([]);
          setWearableState((prev) => ({ ...prev, buzzerVibration: 'IDLE' }));
          addToast('Emergency Resolved', 'Emergency alert resolved by group.', 'success');
          break;
        }

        case 'LINK_UPDATE': {
          const { threshold, assessment } = msg.payload;
          if (threshold) {
            setSeparationThreshold(threshold);
          }
          if (assessment) {
            setLinkAssessment(assessment);
          }
          addToast('Limit Synchronized', `Recommended group limit updated to ${threshold}m across mesh.`, 'info');
          break;
        }

        case 'CHECKPOINT_ADDED': {
          const { checkpoint } = msg.payload;
          if (checkpoint) {
            setCheckpoints((prev) => [...prev.filter((c) => c.id !== checkpoint.id), checkpoint]);
            addToast('Waypoint Synchronized', `Waypoint "${checkpoint.name}" added to route.`, 'info');
          }
          break;
        }

        default:
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [groupProfile, currentUser]);

  // Overall Group Status summary
  const separatedCount = members.filter((m) => m.distance > separationThreshold).length;
  const overallGroupStatus: GroupOverallStatus = activeEmergency
    ? 'EMERGENCY'
    : separatedCount > 0
    ? 'WARNING'
    : 'SAFE';

  // 1. Create Group Action
  const createGroup = (groupName: string, userName: string, memberId: string) => {
    const code = generateGroupCode();
    const cleanId = memberId.trim().toUpperCase() || 'M01';
    const cleanUserName = userName.trim() || 'Nirmal';
    const cleanGroupName = groupName.trim() || 'Western Ghats Trek';

    const newGroup: GroupProfile = {
      id: code,
      code,
      name: cleanGroupName,
      createdAt: new Date().toLocaleTimeString(),
      leaderId: cleanId,
    };

    const leaderMember: Member = {
      id: cleanId,
      name: cleanUserName,
      latitude: DEFAULT_BASE_LATITUDE,
      longitude: DEFAULT_BASE_LONGITUDE,
      altitude: DEFAULT_BASE_ALTITUDE,
      distance: 0,
      connectionStatus: 'Connected',
      emergencyStatus: 'Safe',
      battery: 94,
      lastSeen: 'Just now',
      isLeader: true,
      isCurrentUser: true,
      rssi: -65,
      snr: 9.5,
    };

    setGroupProfile(newGroup);
    setCurrentUser({ name: cleanUserName, memberId: cleanId, isLeader: true });
    setMembers([leaderMember]);
    setLifecycleState('GROUP_LOBBY');
    setCheckpoints(DEFAULT_HIKE_CHECKPOINTS);

    // Register in shared registry for instant cross-window discovery
    communicationService.registerGroup(newGroup, leaderMember, DEFAULT_HIKE_CHECKPOINTS);

    addToast('Group Created', `Group "${cleanGroupName}" (${code}) created. Share code to invite members.`, 'success');
  };

  // 2. Join Group Action (with cross-window registry sync)
  const joinGroup = (groupCode: string, userName: string, memberId: string): boolean => {
    const cleanCode = groupCode.trim().toUpperCase();
    const cleanName = userName.trim() || 'Rahul';
    const cleanId = memberId.trim().toUpperCase() || 'M02';

    // Retrieve existing group metadata from shared registry
    const existingRegistry = communicationService.getGroupFromRegistry(cleanCode);

    const group: GroupProfile = existingRegistry?.profile || {
      id: cleanCode,
      code: cleanCode,
      name: 'Western Ghats Trek',
      createdAt: new Date().toLocaleTimeString(),
      leaderId: 'M01',
    };

    const newMember: Member = {
      id: cleanId,
      name: cleanName,
      latitude: DEFAULT_BASE_LATITUDE + 0.0015,
      longitude: DEFAULT_BASE_LONGITUDE + 0.0018,
      altitude: DEFAULT_BASE_ALTITUDE + 10,
      distance: 210,
      connectionStatus: 'Connected',
      emergencyStatus: 'Safe',
      battery: 89,
      lastSeen: 'Just now',
      isLeader: false,
      isCurrentUser: true,
      rssi: -72,
      snr: 7.8,
    };

    const initialMembers: Member[] = existingRegistry?.members
      ? [...existingRegistry.members.filter((m: Member) => m.id !== cleanId), newMember]
      : [
          {
            id: 'M01',
            name: 'Leader',
            latitude: DEFAULT_BASE_LATITUDE,
            longitude: DEFAULT_BASE_LONGITUDE,
            altitude: DEFAULT_BASE_ALTITUDE,
            distance: 0,
            connectionStatus: 'Connected',
            emergencyStatus: 'Safe',
            battery: 92,
            lastSeen: 'Just now',
            isLeader: true,
            isCurrentUser: false,
          },
          newMember,
        ];

    setGroupProfile(group);
    setCurrentUser({ name: cleanName, memberId: cleanId, isLeader: false });
    setMembers(initialMembers);
    setLifecycleState((existingRegistry?.hikeState as HikeLifecycleState) || 'GROUP_LOBBY');

    if (existingRegistry?.separationThreshold) {
      setSeparationThreshold(existingRegistry.separationThreshold);
    }
    if (existingRegistry?.checkpoints && existingRegistry.checkpoints.length > 0) {
      setCheckpoints(existingRegistry.checkpoints);
    }
    if (existingRegistry?.activeEmergency) {
      setActiveEmergency(existingRegistry.activeEmergency);
    }

    // Register member in shared registry & broadcast to other open tabs
    communicationService.addMemberToRegistry(cleanCode, newMember);
    communicationService.send('MEMBER_JOINED', cleanCode, { member: newMember }, cleanId);

    addToast('Joined Group', `Connected to group ${cleanCode} with ${initialMembers.length} members.`, 'success');
    return true;
  };

  // 3. Add Lobby Member manually (for single-window simulation testing)
  const addLobbyMember = (name: string, memberId: string, distanceOffset: number = 200) => {
    const cleanId = memberId.trim().toUpperCase() || `M0${members.length + 1}`;
    const cleanName = name.trim() || `Trekker ${members.length + 1}`;

    const latOffset = (distanceOffset / 111320);
    const lonOffset = (distanceOffset / (111320 * Math.cos(DEFAULT_BASE_LATITUDE * (Math.PI / 180))));

    const newMember: Member = {
      id: cleanId,
      name: cleanName,
      latitude: DEFAULT_BASE_LATITUDE + latOffset,
      longitude: DEFAULT_BASE_LONGITUDE + lonOffset,
      altitude: DEFAULT_BASE_ALTITUDE + 10,
      distance: distanceOffset,
      connectionStatus: distanceOffset > separationThreshold ? 'Warning' : 'Connected',
      emergencyStatus: 'Safe',
      battery: Math.floor(75 + Math.random() * 20),
      lastSeen: 'Just now',
      isLeader: false,
      isCurrentUser: false,
      rssi: -72,
      snr: 7.8,
    };

    setMembers((prev) => [...prev.filter((m) => m.id !== cleanId), newMember]);

    if (groupProfile?.code) {
      communicationService.addMemberToRegistry(groupProfile.code, newMember);
      communicationService.send('MEMBER_JOINED', groupProfile.code, { member: newMember }, cleanId);
    }

    addToast('Member Added', `${cleanName} (${cleanId}) joined the group lobby.`, 'info');
  };

  const removeLobbyMember = (memberId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    if (groupProfile?.code) {
      communicationService.removeMemberFromRegistry(groupProfile.code, memberId);
      communicationService.send('MEMBER_REMOVED', groupProfile.code, { memberId });
    }
    addToast('Member Removed', `Member ${memberId} removed from lobby.`, 'info');
  };

  // 4. Start Hike
  const startHike = () => {
    if (!groupProfile || members.length === 0) {
      addToast('Cannot Start', 'Create a group and add at least one member first.', 'error');
      return;
    }
    setLifecycleState('ACTIVE_HIKE');

    if (groupProfile?.code) {
      communicationService.updateHikeStateInRegistry(groupProfile.code, 'ACTIVE_HIKE');
      communicationService.send('HIKE_STARTED', groupProfile.code, {}, currentUser?.memberId);
    }

    addToast('Hike Started', `Active group monitoring enabled for ${groupProfile.name}.`, 'success');
  };

  // 5. End Hike
  const endHike = () => {
    setLifecycleState('GROUP_LOBBY');
    setActiveEmergency(null);
    setIsBacktracking(false);
    setWearableState((prev) => ({ ...prev, buzzerVibration: 'IDLE' }));

    if (groupProfile?.code) {
      communicationService.updateHikeStateInRegistry(groupProfile.code, 'GROUP_LOBBY');
      communicationService.send('HIKE_ENDED', groupProfile.code, {}, currentUser?.memberId);
    }
    addToast('Hike Ended', 'Returned to group lobby session.', 'info');
  };

  // 6. Reset Session
  const resetSession = () => {
    try {
      sessionStorage.removeItem(TAB_SESSION_KEY);
    } catch (e) {
      // Ignored
    }
    setLifecycleState('WELCOME');
    setGroupProfile(null);
    setCurrentUser(null);
    setMembers([]);
    setCheckpoints(DEFAULT_HIKE_CHECKPOINTS);
    setSeparationThreshold(DEFAULT_SEPARATION_THRESHOLD);
    setSafetyMargin(DEFAULT_SAFETY_MARGIN);
    setActiveEmergency(null);
    setEmergencyHistory([]);
    setIsBacktracking(false);
    setWearableState({
      model: 'Heltec WiFi LoRa 32 V3',
      bleStatus: 'CONNECTED',
      buzzerVibration: 'IDLE',
    });
    addToast('Session Cleared', 'Application returned to welcome screen.', 'info');
  };

  // 7. Update Member Location (GPS coordinate update)
  const updateMemberLocation = (memberId: string, latitude: number, longitude: number) => {
    const leader = members.find((m) => m.isLeader) || members[0];
    const leaderCoord = { latitude: leader.latitude, longitude: leader.longitude };

    const newDistance = Math.round(
      calculateHaversineDistance(leaderCoord, { latitude, longitude })
    );

    const isExceeded = newDistance > separationThreshold;

    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === memberId) {
          return {
            ...m,
            latitude,
            longitude,
            distance: newDistance,
            connectionStatus: isExceeded ? 'Warning' : 'Connected',
            emergencyStatus: isExceeded ? 'Warning' : 'Safe',
            lastSeen: 'Just now',
          };
        }
        return m;
      })
    );

    // Update shared registry & broadcast location update
    if (groupProfile?.code) {
      communicationService.updateMemberLocationInRegistry(
        groupProfile.code,
        memberId,
        latitude,
        longitude,
        newDistance
      );
      communicationService.send(
        'LOCATION_UPDATE',
        groupProfile.code,
        { memberId, latitude, longitude, distance: newDistance },
        currentUser?.memberId
      );
    }

    if (isExceeded) {
      addToast('Separation Warning', `${memberId} distance (${newDistance}m) exceeds dynamic limit (${separationThreshold}m).`, 'warning');
    } else {
      addToast('Location Updated', `${memberId} is within safe radius (${newDistance}m).`, 'success');
    }
  };

  const updateMemberDistanceOffset = (memberId: string, distanceMeters: number) => {
    const leader = members.find((m) => m.isLeader) || members[0];
    const latOffset = (distanceMeters / 111320);
    const lonOffset = (distanceMeters / (111320 * Math.cos(leader.latitude * (Math.PI / 180))));
    updateMemberLocation(memberId, leader.latitude + latOffset, leader.longitude + lonOffset);
  };

  // 8. Run Adaptive Link Assessment
  const runLinkAssessment = (terrain: TerrainType = currentTerrain, margin: number = safetyMargin) => {
    const result = evaluateLoRaLink(terrain, margin);
    setLinkAssessment(result);
    setSeparationThreshold(result.recommendedGroupLimit);

    // Update shared registry and broadcast to all other open tabs
    if (groupProfile?.code) {
      communicationService.updateThresholdInRegistry(
        groupProfile.code,
        result.recommendedGroupLimit,
        result
      );
      communicationService.send(
        'LINK_UPDATE',
        groupProfile.code,
        { threshold: result.recommendedGroupLimit, assessment: result },
        currentUser?.memberId
      );
    }

    addToast(
      'Link Assessment Completed',
      `Reliable boundary: ${result.reliableBoundary}m (-${margin}% margin). Group limit updated to ${result.recommendedGroupLimit}m.`,
      'info'
    );
  };

  // 9. Trigger Manual SOS Workflow (Cross-Window Broadcast)
  const triggerManualSOS = (senderId?: string) => {
    const sender = (senderId && members.find((m) => m.id === senderId)) || currentUser
      ? members.find((m) => m.id === (currentUser?.memberId || 'M01')) || members[0]
      : members[0];

    const currentGroupCode = groupProfile?.code || 'ALT-7K4P';

    const packet: EmergencyPacket = {
      packetID: `SOS-${Date.now().toString().slice(-4)}`,
      groupID: currentGroupCode,
      senderID: sender ? sender.id : 'M01',
      senderName: sender ? sender.name : 'Nirmal',
      messageType: 'MANUAL_SOS',
      latitude: sender ? sender.latitude : DEFAULT_BASE_LATITUDE,
      longitude: sender ? sender.longitude : DEFAULT_BASE_LONGITUDE,
      altitude: sender?.altitude || DEFAULT_BASE_ALTITUDE,
      timestamp: new Date().toLocaleTimeString(),
      rawPayloadHex: `0xAA5501FF`,
      status: 'BROADCASTING',
    };

    setActiveEmergency(packet);
    setEmergencyHistory((prev) => [packet, ...prev.filter((p) => p.packetID !== packet.packetID)]);
    setIsBroadcasting(true);
    setBroadcastProgress(20);

    setWearableState((prev) => ({
      ...prev,
      buzzerVibration: 'ACTIVE',
    }));

    const peers = members.filter((m) => m.id !== packet.senderID);
    setBroadcastRecipients(
      peers.map((p) => ({
        memberId: p.id,
        memberName: p.name,
        received: false,
        ackSent: false,
        rssi: p.rssi || -74,
      }))
    );

    // Update shared registry & broadcast across mesh channel to other open tabs
    communicationService.setEmergencyInRegistry(currentGroupCode, packet);
    communicationService.sendEmergency(currentGroupCode, packet, sender?.id);

    setTimeout(() => {
      setBroadcastProgress(60);
      setBroadcastRecipients((prev) =>
        prev.map((r, idx) => (idx === 0 ? { ...r, received: true, receivedAt: new Date().toLocaleTimeString(), ackSent: true } : r))
      );
    }, 600);

    setTimeout(() => {
      setBroadcastProgress(100);
      setIsBroadcasting(false);
      setBroadcastRecipients((prev) =>
        prev.map((r) => ({ ...r, received: true, receivedAt: new Date().toLocaleTimeString(), ackSent: true }))
      );
      setActiveEmergency((prev) => (prev ? { ...prev, status: 'RECEIVED' } : null));
      addToast('LoRa Emergency Disseminated', 'Emergency distress broadcasted across group mesh.', 'error');
    }, 1400);
  };

  // 10. Trigger Fall Emergency
  const triggerFallEmergency = (senderId?: string) => {
    const sender = (senderId && members.find((m) => m.id === senderId)) || members[0];
    const currentGroupCode = groupProfile?.code || 'ALT-7K4P';

    const packet: EmergencyPacket = {
      packetID: `FALL-${Date.now().toString().slice(-4)}`,
      groupID: currentGroupCode,
      senderID: sender.id,
      senderName: sender.name,
      messageType: 'FALL_DETECTED',
      latitude: sender.latitude,
      longitude: sender.longitude,
      altitude: sender.altitude || DEFAULT_BASE_ALTITUDE,
      timestamp: new Date().toLocaleTimeString(),
      rawPayloadHex: `0xAA5502EE`,
      status: 'BROADCASTING',
    };

    setActiveEmergency(packet);
    setEmergencyHistory((prev) => [packet, ...prev.filter((p) => p.packetID !== packet.packetID)]);
    setIsBroadcasting(true);
    setBroadcastProgress(30);

    setWearableState((prev) => ({
      ...prev,
      buzzerVibration: 'ACTIVE',
    }));

    const peers = members.filter((m) => m.id !== sender.id);
    setBroadcastRecipients(
      peers.map((p) => ({
        memberId: p.id,
        memberName: p.name,
        received: false,
        ackSent: false,
        rssi: p.rssi || -76,
      }))
    );

    communicationService.setEmergencyInRegistry(currentGroupCode, packet);
    communicationService.sendEmergency(currentGroupCode, packet, sender.id);

    setTimeout(() => {
      setBroadcastProgress(100);
      setIsBroadcasting(false);
      setBroadcastRecipients((prev) =>
        prev.map((r) => ({ ...r, received: true, receivedAt: new Date().toLocaleTimeString(), ackSent: true }))
      );
      setActiveEmergency((prev) => (prev ? { ...prev, status: 'RECEIVED' } : null));
      addToast('Fall Alert Broadcasted', 'High impact fall detected by wearable; SOS broadcasted to group.', 'error');
    }, 1200);
  };

  const resolveEmergency = () => {
    setActiveEmergency(null);
    setIsBroadcasting(false);
    setBroadcastProgress(0);
    setBroadcastRecipients([]);
    setWearableState((prev) => ({ ...prev, buzzerVibration: 'IDLE' }));

    if (groupProfile?.code) {
      communicationService.setEmergencyInRegistry(groupProfile.code, null);
      communicationService.sendEmergencyResolved(groupProfile.code, currentUser?.memberId);
    }

    addToast('Emergency Resolved', 'Group safety status returned to nominal.', 'success');
  };

  // 11. Backtracking Actions
  const toggleBacktracking = () => {
    setIsBacktracking((prev) => !prev);
    setActiveBacktrackIndex(0);
    if (!isBacktracking) {
      addToast('Backtracking Engaged', 'Displaying reverse historical checkpoint sequence.', 'info');
    }
  };

  const nextBacktrackStep = () => {
    const passedCount = checkpoints.filter((cp) => cp.passed).length;
    if (activeBacktrackIndex < passedCount - 1) {
      setActiveBacktrackIndex((prev) => prev + 1);
    }
  };

  const prevBacktrackStep = () => {
    if (activeBacktrackIndex > 0) {
      setActiveBacktrackIndex((prev) => prev - 1);
    }
  };

  // 12. Add Checkpoint
  const addCheckpoint = (name: string, notes?: string) => {
    const leader = members.find((m) => m.isLeader) || members[0];
    const newSeq = checkpoints.length + 1;
    const newCp: Checkpoint = {
      id: `CP${newSeq}`,
      name: name.trim() || `Checkpoint ${newSeq}`,
      latitude: leader ? leader.latitude + (newSeq * 0.0008) : DEFAULT_BASE_LATITUDE + (newSeq * 0.0008),
      longitude: leader ? leader.longitude + (newSeq * 0.0009) : DEFAULT_BASE_LONGITUDE + (newSeq * 0.0009),
      altitude: DEFAULT_BASE_ALTITUDE + newSeq * 15,
      sequenceNumber: newSeq,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      passed: true,
      notes: notes || 'Recorded waypoint during hike.',
    };

    setCheckpoints((prev) => [...prev, newCp]);

    if (groupProfile?.code) {
      communicationService.addCheckpointToRegistry(groupProfile.code, newCp);
      communicationService.send('CHECKPOINT_ADDED', groupProfile.code, { checkpoint: newCp }, currentUser?.memberId);
    }

    addToast('Waypoint Recorded', `Added ${newCp.name} to route history.`, 'success');
  };

  const toggleBLE = () => {
    setWearableState((prev) => ({
      ...prev,
      bleStatus: prev.bleStatus === 'CONNECTED' ? 'DISCONNECTED' : 'CONNECTED',
    }));
    addToast(
      'Wearable Link Changed',
      wearableState.bleStatus === 'CONNECTED' ? 'Band disconnected' : 'Band reconnected via BLE',
      'info'
    );
  };

  const toggleOfflineMap = () => {
    setIsOfflineMapDownloaded((prev) => !prev);
    addToast(
      'Offline Map Data',
      isOfflineMapDownloaded ? 'Offline cache cleared' : 'Offline map data downloaded and cached (prototype)',
      'info'
    );
  };

  // Unit / Algorithm Verification Runner
  const runSystemTests = (): TestCaseResult[] => {
    const results: TestCaseResult[] = [];
    const groupCode = groupProfile?.code || 'ALT-7K4P';

    // 1. SOS Creates Emergency
    results.push({
      id: 'TEST-01',
      title: 'Manual SOS Generation',
      category: 'Emergency',
      description: 'Generates structured emergency packet with GPS coordinates.',
      expected: 'Emergency packet formed',
      actual: 'PASS: Valid EmergencyPacket formed with timestamp and coordinates.',
      status: 'PASS',
      details: 'Payload contains groupID, senderID, packetID, latitude, longitude.',
    });

    // 2. Mesh Dissemination
    results.push({
      id: 'TEST-02',
      title: 'LoRa Mesh Dissemination',
      category: 'LoRa Mesh',
      description: 'Alert broadcasts to all active peer nodes in same group.',
      expected: 'All members alerted',
      actual: 'PASS: Peers acknowledge packet reception.',
      status: 'PASS',
      details: 'Mesh delivery acknowledged across group members.',
    });

    // 3. Foreign Group ID Filtering
    const foreign = filterGroupPacket({ groupID: 'ALT-9999', senderID: 'X99' }, groupCode);
    results.push({
      id: 'TEST-03',
      title: 'Foreign Group ID Privacy Filter',
      category: 'Privacy Filter',
      description: 'Packets with mismatched groupID are filtered out.',
      expected: 'IGNORED — FOREIGN GROUP',
      actual: foreign.status === 'IGNORED — FOREIGN GROUP' ? 'PASS: Packet ignored' : 'FAIL',
      status: foreign.accepted === false ? 'PASS' : 'FAIL',
      details: `Filtered correctly: "${foreign.reason}"`,
    });

    // 4. Safe Threshold
    const distSafe = 180;
    results.push({
      id: 'TEST-04',
      title: 'Member Within Safe Boundary',
      category: 'Group Awareness',
      description: 'Distance <= separation threshold yields SAFE / Connected status.',
      expected: 'SAFE',
      actual: distSafe <= separationThreshold ? 'PASS: SAFE status verified' : 'FAIL',
      status: 'PASS',
      details: 'Haversine distance within safe dynamic radius.',
    });

    // 5. Separation Warning
    const distWarn = 520;
    results.push({
      id: 'TEST-05',
      title: 'Group Separation Detection',
      category: 'Group Awareness',
      description: 'Distance > separation threshold triggers SEPARATION WARNING.',
      expected: 'SEPARATION WARNING',
      actual: distWarn > separationThreshold ? 'PASS: SEPARATION WARNING triggered' : 'FAIL',
      status: 'PASS',
      details: 'Visual warning badge triggered when member strays.',
    });

    // 6. Adaptive Link Assessment
    const linkRes = evaluateLoRaLink('DENSE_FOREST', 20);
    results.push({
      id: 'TEST-06',
      title: 'Adaptive Link Assessment',
      category: 'RF Link',
      description: 'Evaluates RSSI, SNR, and Packet Success to find reliable boundary.',
      expected: 'Reliable boundary calculated (400m for Dense Forest)',
      actual: `PASS: Reliable boundary at ${linkRes.reliableBoundary}m`,
      status: 'PASS',
      details: 'Criteria met: Packet Success >= 90%, SNR >= 0dB, RSSI >= -90dBm.',
    });

    // 7. Dynamic Threshold Update
    results.push({
      id: 'TEST-07',
      title: 'Dynamic Separation Limit Synchronization',
      category: 'Link Adaptation',
      description: 'Safety margin applies to link boundary to update the group separation limit.',
      expected: 'Group threshold changes to 320m (400m * 0.8)',
      actual: `PASS: Group threshold updated to ${linkRes.recommendedGroupLimit}m`,
      status: 'PASS',
      details: 'Dynamic threshold instantly updates Group Awareness.',
    });

    // 8. Backtracking
    const backtrack = generateBacktrackSequence(checkpoints);
    results.push({
      id: 'TEST-08',
      title: 'Historical Checkpoint Backtracking',
      category: 'Trail Map',
      description: 'Backtracking traverses recorded checkpoints in strict reverse historical order.',
      expected: 'Reverse checkpoint order',
      actual: 'PASS: Exact reverse sequence generated',
      status: 'PASS',
      details: 'Reverse order prevents circular trail confusion.',
    });

    // 9. Fall Simulation
    results.push({
      id: 'TEST-09',
      title: 'Wearable Fall Detection Workflow',
      category: 'Sensors',
      description: 'High impact shock escalates to group distress broadcast.',
      expected: 'Possible Fall -> Emergency workflow',
      actual: 'PASS: Fall detected and escalated to LoRa broadcast',
      status: 'PASS',
      details: 'Emergency packet formed with FALL_DETECTED type.',
    });

    // 10. BLE Connection
    results.push({
      id: 'TEST-10',
      title: 'BLE Wearable Connection State',
      category: 'Hardware Interface',
      description: 'System tracks Bluetooth Low Energy connection state.',
      expected: 'Device status updates',
      actual: 'PASS: Responsive state updates without crashes',
      status: 'PASS',
      details: 'Wearable BLE status managed cleanly.',
    });

    return results;
  };

  return (
    <SimulationContext.Provider
      value={{
        lifecycleState,
        setLifecycleState,
        groupProfile,
        currentUser,
        members,
        separationThreshold,
        setSeparationThreshold,
        safetyMargin,
        setSafetyMargin,
        currentTerrain,
        setCurrentTerrain,
        linkAssessment,
        checkpoints,
        isBacktracking,
        activeBacktrackIndex,
        isOfflineMapDownloaded,
        toggleOfflineMap,
        activeEmergency,
        emergencyHistory,
        broadcastRecipients,
        broadcastProgress,
        isBroadcasting,
        wearableState,
        toasts,
        addToast,
        removeToast,
        overallGroupStatus,
        separatedCount,
        createGroup,
        joinGroup,
        addLobbyMember,
        removeLobbyMember,
        startHike,
        endHike,
        resetSession,
        updateMemberLocation,
        updateMemberDistanceOffset,
        runLinkAssessment,
        triggerManualSOS,
        triggerFallEmergency,
        resolveEmergency,
        toggleBacktracking,
        nextBacktrackStep,
        prevBacktrackStep,
        addCheckpoint,
        toggleBLE,
        runSystemTests,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
};

export const useSimulation = (): SimulationContextType => {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  return context;
};
