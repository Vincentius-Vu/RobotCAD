import React, { useEffect } from 'react';
import { useRobotStore } from './store/robotStore';
import { MainLayout } from './layout/MainLayout';

export const App: React.FC = () => {
  const loadRobot = useRobotStore((state) => state.loadRobot);

  useEffect(() => {
    // Load initial robot model (Puma 560 as requested)
    loadRobot('Puma560');
  }, [loadRobot]);

  return <MainLayout />;
};

export default App;
