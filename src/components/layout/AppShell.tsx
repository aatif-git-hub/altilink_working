import { DevicePanel } from '../hardware/DevicePanel';
import React, { useState } from 'react';
import { Sidebar, TabType } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNav } from './MobileNav';
import { ToastContainer } from '../common/ToastContainer';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { useSimulation } from '../../context/SimulationContext';

import { WelcomeScreen } from '../../pages/WelcomeScreen';
import { GroupLobbyPage } from '../../pages/GroupLobbyPage';
import { DashboardPage } from '../../pages/DashboardPage';
import { TrailMapPage } from '../../pages/TrailMapPage';
import { LinkStatusPage } from '../../pages/LinkStatusPage';
import { EmergencyPage } from '../../pages/EmergencyPage';

export const AppShell: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isSOSModalOpen, setIsSOSModalOpen] = useState<boolean>(false);

  const { lifecycleState, activeEmergency, triggerManualSOS, dataMode } = useSimulation();

  // 1. Welcome Screen
  if (lifecycleState === 'WELCOME') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <WelcomeScreen />
        <ToastContainer />
      </div>
    );
  }

  // 2. Group Lobby Screen
  if (lifecycleState === 'GROUP_LOBBY') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8">
        <div className="max-w-6xl mx-auto"><DevicePanel /></div>
        <GroupLobbyPage />
        <ToastContainer />
      </div>
    );
  }

  // 3. Active Hike Screen
  const renderActivePage = () => {
    switch (activeTab) {
      case 'home':
        return (
          <DashboardPage
            setActiveTab={setActiveTab}
            onOpenSOSModal={() => setIsSOSModalOpen(true)}
          />
        );
      case 'map':
        return <TrailMapPage />;
      case 'link':
        return <LinkStatusPage setActiveTab={setActiveTab} />;
      case 'emergency':
        return <EmergencyPage />;
      default:
        return (
          <DashboardPage
            setActiveTab={setActiveTab}
            onOpenSOSModal={() => setIsSOSModalOpen(true)}
          />
        );
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 overflow-hidden select-none">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenSOSModal={() => setIsSOSModalOpen(true)}
        />
      </div>

      {/* Main App Container */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        <TopBar onOpenSOSModal={() => setIsSOSModalOpen(true)} />

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-6 max-w-6xl w-full mx-auto pb-20 md:pb-8">
          <DevicePanel />
          {renderActivePage()}
        </main>

        {/* Mobile Navigation */}
        <MobileNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          hasEmergency={activeEmergency !== null}
        />
      </div>

      {/* Emergency Confirmation Modal */}
      <ConfirmationModal
        isOpen={isSOSModalOpen}
        onClose={() => setIsSOSModalOpen(false)}
        onConfirm={() => {
          triggerManualSOS();
          setActiveTab('emergency');
        }}
        title="Broadcast Emergency SOS"
        message={dataMode === "hardware" ? "Send an SOS through your band over LoRa? Location is included only when its GPS has a fresh fix. Delivery needs a peer acknowledgement." : "Simulate a distress alert within the software group? No physical LoRa transmission occurs."}
      />

      <ToastContainer />
    </div>
  );
};
