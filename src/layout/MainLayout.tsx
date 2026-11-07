import React, { useState, useEffect } from 'react';
import { useRobotStore } from '../store/robotStore';
import { TopRibbon } from './TopRibbon';
import { LeftSidebar } from './LeftSidebar/LeftSidebar';
import { RightInspector } from './RightInspector/RightInspector';
import { BottomDock } from './BottomDock/BottomDock';
import { Canvas3D } from '../components/Viewport/Canvas3D';
import { CompactPoseHUD } from './CenterViewport/CompactPoseHUD';
import { MobilePoseHUD } from './CenterViewport/MobilePoseHUD';
import { CameraPresetsHUD } from './CenterViewport/CameraPresetsHUD';
import { EnvironmentCameraPanel } from '../components/UI/EnvironmentCameraPanel';
import { TrajectoryExportModal } from '../components/UI/TrajectoryExportModal';
import { CodeExportModal } from '../components/Export/CodeExportModal';
import { DHQuizModal } from '../components/VirtualLab/DHQuizModal';
import { VirtualCaliperModal } from '../components/VirtualLab/VirtualCaliperModal';
import { AcademicReportModal } from '../components/Export/AcademicReportModal';
import { MultiPhysicsOscilloscopeDialog } from '../components/Dynamics/MultiPhysicsOscilloscopeDialog';
import { AddPoseModal } from '../components/UI/AddPoseModal';

export const MainLayout: React.FC = () => {
  const [isEnvCameraOpen, setIsEnvCameraOpen] = useState(false);
  const [isExportPNGOpen, setIsExportPNGOpen] = useState(false);
  const [isCodeExportOpen, setIsCodeExportOpen] = useState(false);
  const [isDHQuizOpen, setIsDHQuizOpen] = useState(false);
  const [isCaliperOpen, setIsCaliperOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isOscilloscopeOpen, setIsOscilloscopeOpen] = useState(false);

  const {
    activeDomain,
    toggleLeftSidebar,
    toggleRightInspector,
    activeTrajectory,
    playbackState,
    playTrajectory,
    pauseTrajectory,
    isAddPoseModalOpen,
    closeAddPoseModal,
  } = useRobotStore();

  // Commercial keyboard hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }

      if (e.key === ' ' && activeTrajectory && activeTrajectory.samples.length > 1) {
        e.preventDefault();
        if (playbackState.isPlaying) {
          pauseTrajectory();
        } else {
          playTrajectory();
        }
      } else if (e.key === 'b' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        toggleLeftSidebar();
      } else if (e.key === 'i' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        toggleRightInspector();
      } else if (e.key === 'Escape') {
        setIsEnvCameraOpen(false);
        setIsExportPNGOpen(false);
        setIsCodeExportOpen(false);
        setIsDHQuizOpen(false);
        setIsCaliperOpen(false);
        setIsReportOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTrajectory,
    playbackState.isPlaying,
    playTrajectory,
    pauseTrajectory,
    toggleLeftSidebar,
    toggleRightInspector,
  ]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-950 font-sans flex flex-col text-slate-100 select-none">
      {/* 1. Top Industrial Ribbon */}
      <TopRibbon
        onOpenEnvCamera={() => setIsEnvCameraOpen(true)}
        onOpenExportPNG={() => setIsExportPNGOpen(true)}
        onOpenCodeExport={() => setIsCodeExportOpen(true)}
        onOpenDHQuiz={() => setIsDHQuizOpen(true)}
        onOpenCaliper={() => setIsCaliperOpen(true)}
        onOpenReport={() => setIsReportOpen(true)}
        onOpenOscilloscopeDialog={() => setIsOscilloscopeOpen(true)}
      />

      {/* 2. Middle Central Row (Left Sidebar + Viewport + Right Inspector) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Collapsible Tool Dock */}
        <LeftSidebar />

        {/* Central 3D Viewport with Floating CAD/CAE HUDs */}
        <main className="flex-1 relative overflow-hidden bg-slate-950">
          <Canvas3D />

          {/* Transparent Floating HUDs inside the Viewport */}
          {activeDomain === 'manipulator' ? (
            <>
              <CameraPresetsHUD />
              <CompactPoseHUD />
            </>
          ) : (
            <MobilePoseHUD />
          )}
        </main>

        {/* Right Collapsible Inspector */}
        <RightInspector />
      </div>

      {/* 3. Bottom Dock (Timeline Transport + Motion Profile Curves) */}
      <BottomDock onOpenOscilloscopeDialog={() => setIsOscilloscopeOpen(true)} />

      {/* Global Modals */}
      <MultiPhysicsOscilloscopeDialog
        isOpen={isOscilloscopeOpen}
        onClose={() => setIsOscilloscopeOpen(false)}
      />
      <EnvironmentCameraPanel
        isOpen={isEnvCameraOpen}
        onClose={() => setIsEnvCameraOpen(false)}
      />

      <TrajectoryExportModal
        isOpen={isExportPNGOpen}
        onClose={() => setIsExportPNGOpen(false)}
      />

      <CodeExportModal
        isOpen={isCodeExportOpen}
        onClose={() => setIsCodeExportOpen(false)}
      />

      <DHQuizModal
        isOpen={isDHQuizOpen}
        onClose={() => setIsDHQuizOpen(false)}
      />

      <VirtualCaliperModal
        isOpen={isCaliperOpen}
        onClose={() => setIsCaliperOpen(false)}
      />

      <AcademicReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
      />

      <AddPoseModal
        isOpen={isAddPoseModalOpen}
        onClose={closeAddPoseModal}
      />
    </div>
  );
};
