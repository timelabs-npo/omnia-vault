import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import OptimizeMaintenanceView from './components/OptimizeMaintenanceView';
import Dashboard from './components/Dashboard';
import DiskLensView from './components/DiskLensView';
import DualPaneExplorer from './components/DualPaneExplorer';
import DuplicateFinderView from './components/DuplicateFinderView';
import ScreenshotConsolidatorView from './components/ScreenshotConsolidatorView';
import SafeRoutinePlanner from './components/SafeRoutinePlanner';
import AutocleanRules from './components/AutocleanRules';
import ActivityLog from './components/ActivityLog';
import SettingsModal from './components/SettingsModal';
import Toast from './components/Toast';
import SystemPropagatorView from './components/SystemPropagatorView';
import CloudSyncMonitorView from './components/CloudSyncMonitorView';


const API_BASE = 'http://localhost:3001/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [statusData, setStatusData] = useState(null);
  const [files, setFiles] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [screenshotFolders, setScreenshotFolders] = useState([]);
  const [routineSchema, setRoutineSchema] = useState(null);
  const [rules, setRules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null); // { message, type }

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/status`);
      if (res.ok) setStatusData(await res.json());
    } catch (e) {}
  };

  const fetchFiles = async () => {
    try {
      const res = await fetch(`${API_BASE}/files`);
      if (res.ok) setFiles(await res.json());
    } catch (e) {}
  };

  const fetchDuplicates = async () => {
    try {
      const res = await fetch(`${API_BASE}/duplicates`);
      if (res.ok) setDuplicates(await res.json());
    } catch (e) {}
  };

  const fetchScreenshotFolders = async () => {
    try {
      const res = await fetch(`${API_BASE}/screenshots-folders`);
      if (res.ok) setScreenshotFolders(await res.json());
    } catch (e) {}
  };

  const fetchRoutinePlanner = async () => {
    try {
      const res = await fetch(`${API_BASE}/routine-planner`);
      if (res.ok) setRoutineSchema(await res.json());
    } catch (e) {}
  };

  const fetchRules = async () => {
    try {
      const res = await fetch(`${API_BASE}/rules`);
      if (res.ok) setRules(await res.json());
    } catch (e) {}
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/logs`);
      if (res.ok) setLogs(await res.json());
    } catch (e) {}
  };

  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchStatus(),
      fetchFiles(),
      fetchDuplicates(),
      fetchScreenshotFolders(),
      fetchRoutinePlanner(),
      fetchRules(),
      fetchLogs()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    refreshAll();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleEmergencyClean = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/emergency-clean`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        showToast(`Emergency Clean Complete! ${data.reclaimedGB} GB permanently purged. macOS Software update unblocked!`);
      }
    } catch (e) {}
    await refreshAll();
    setLoading(false);
  };

  const handleEmergencyRestore = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/emergency-restore`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        showToast(`Restoration Complete! ${data.restoredGB} GB hydrated back to your local drive.`, 'success');
      }
    } catch (e) {}
    await refreshAll();
    setLoading(false);
  };

  const handleCleanSafari = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/clean-safari`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        showToast(`Safari Cache Purged! ~${data.reclaimedGB} GB reclaimed.`);
      }
    } catch (e) {}
    await refreshAll();
    setLoading(false);
  };

  const handleConsolidateScreenshots = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/consolidate-screenshots`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        showToast(`Desktop & Cloud Screenshots Consolidated! ${data.consolidatedCount} capture files swept into ~/Pictures/Unified_Screenshots/2026/!`);
      }
    } catch (e) {}
    await refreshAll();
    setLoading(false);
  };

  const handleMergeCache = async (groupName) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/merge-app-cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupName })
      });
      if (res.ok) {
        showToast(`App Caches for "${groupName}" successfully merged & backed up to Remote Vault!`);
      }
    } catch (e) {}
    await refreshAll();
    setLoading(false);
  };

  const handleDeleteDuplicateApp = async (groupName) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/delete-duplicate-app`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupName })
      });
      if (res.ok) await refreshAll();
    } catch (e) {}
    setLoading(false);
  };

  const handleOffloadFiles = async (fileIds, targetVault) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/offload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds, targetVault })
      });
      if (res.ok) await refreshAll();
    } catch (e) {}
    setLoading(false);
  };

  const handleHydrateFile = async (fileId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/hydrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId })
      });
      if (res.ok) await refreshAll();
    } catch (e) {}
    setLoading(false);
  };

  const handleToggleRule = async (ruleId) => {
    try {
      const res = await fetch(`${API_BASE}/toggle-rule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId })
      });
      if (res.ok) await fetchRules();
    } catch (e) {}
  };

  const handleTogglePropagatorSetting = async (key) => {
    // Optimistically update the UI is handled by a local fetch in SystemPropagatorView
    // We just pass down the statusData
  };

  return (
    <div class="window-container">
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
      
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        statusData={statusData}
      />

      <main class="main-view">
        <Header 
          activeTab={activeTab} 
          loading={loading}
          onRefresh={refreshAll}
          onEmergencyClean={handleEmergencyClean}
          statusData={statusData}
        />

        {activeTab === 'dashboard' && (
          <Dashboard 
            statusData={statusData}
            onEmergencyClean={handleEmergencyClean}
            onEmergencyRestore={handleEmergencyRestore}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onCleanSafari={handleCleanSafari}
          />
        )}
        
        {activeTab === 'optimize' && (
          <OptimizeMaintenanceView />
        )}

        {activeTab === 'disklens' && (
          <DiskLensView 
            statusData={statusData}
            onEmergencyClean={handleEmergencyClean}
            onCleanSafari={handleCleanSafari}
            onConsolidateScreenshots={handleConsolidateScreenshots}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'propagator' && (
          <SystemPropagatorView 
            statusData={statusData}
            onTogglePropagatorSetting={async (key) => {
               const newValue = !statusData?.propagatorSettings?.[key];
               await fetch(`${API_BASE}/settings/propagator`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ [key]: newValue })
               });
               await refreshAll();
            }}
          />
        )}

        {activeTab === 'explorer' && (
          <DualPaneExplorer 
            files={files}
            onOffloadFiles={handleOffloadFiles}
            onHydrateFile={handleHydrateFile}
            loading={loading}
          />
        )}

        {activeTab === 'duplicates' && (
          <DuplicateFinderView 
            duplicates={duplicates}
            onDeleteDuplicate={handleDeleteDuplicateApp}
            onMergeCache={handleMergeCache}
          />
        )}

        {activeTab === 'screenshots' && (
          <ScreenshotConsolidatorView 
            folders={screenshotFolders}
            onConsolidate={handleConsolidateScreenshots}
          />
        )}

        {activeTab === 'routine' && (
          <SafeRoutinePlanner 
            routineSchema={routineSchema}
          />
        )}

        {activeTab === 'cloud' && (
          <CloudSyncMonitorView />
        )}

        {activeTab === 'rules' && (
          <AutocleanRules 
            rules={rules}
            onToggleRule={handleToggleRule}
            onEmergencyClean={handleEmergencyClean}
            loading={loading}
          />
        )}

        {activeTab === 'activity' && (
          <ActivityLog logs={logs} />
        )}

        {activeTab === 'settings' && (
          <SettingsModal />
        )}
      </main>
    </div>
  );
}
