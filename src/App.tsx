import React from 'react';
import { SimulationProvider } from './context/SimulationContext';
import { AppShell } from './components/layout/AppShell';

export const App: React.FC = () => {
  return (
    <SimulationProvider>
      <AppShell />
    </SimulationProvider>
  );
};

export default App;
