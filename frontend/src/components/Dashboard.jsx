import React, { useState } from 'react';
import { AlertTriangle, HardDrive, Image, Download, Code, Layers, ArrowUpRight, Zap, CheckCircle2, Copy, Compass, Trash2, ShieldCheck, Power } from 'lucide-react';
import Unblock28GBModal from './Unblock28GBModal';

export default function Dashboard({ statusData, onEmergencyClean, onEmergencyRestore, onNavigateTab, onCleanSafari }) {
  const freeSpaceGB = statusData ? statusData.macSystemFreeGB : 13.22;
  const potentialGB = statusData ? statusData.potentialReclaimGB : 35.4;
  const offloadedGB = statusData ? statusData.totalOffloadedGB : 2.10;
  const safariCacheGB = statusData ? statusData.safariCacheGB : '0.00';
  const stubsCount = statusData ? statusData.stubsCount : 1;
  const duplicateAppsCount = statusData ? statusData.duplicateAppsCount : 4;

  const [show28Modal, setShow28Modal] = useState(false);
  const [safariPurged, setSafariPurged] = useState(false);
  
  // Propagator Settings State (Fallback to defaults if not loaded yet)
  const [propagatorSettings, setPropagatorSettings] = useState({
    watchdog: statusData?.propagatorSettings?.watchdog ?? true,
    redis: statusData?.propagatorSettings?.redis ?? false,
    github: statusData?.propagatorSettings?.github ?? false
  });

  // Keep state in sync if backend updates
  React.useEffect(() => {
    if (statusData?.propagatorSettings) {
      setPropagatorSettings(statusData.propagatorSettings);
    }
  }, [statusData?.propagatorSettings]);

  const toggleSetting = async (key) => {
    const newValue = !propagatorSettings[key];
    setPropagatorSettings(prev => ({ ...prev, [key]: newValue }));
    
    try {
      await fetch('http://localhost:3001/api/settings/propagator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: newValue })
      });
    } catch (err) {
      console.error('Failed to update propagator settings', err);
      // Revert on failure
      setPropagatorSettings(prev => ({ ...prev, [key]: !newValue }));
    }
  };

  const handleSafariPurge = async () => {
    await onCleanSafari();
    setSafariPurged(true);
  };

  return (
    <div class="content-area">
      {show28Modal && (
        <Unblock28GBModal 
          isRestoreMode={statusData?.isEmergencyCleaned}
          onClose={() => setShow28Modal(false)}
          onConfirmUnblock={async () => {
            await onEmergencyClean();
            setShow28Modal(false);
          }}
          onConfirmRestore={async () => {
            await onEmergencyRestore();
            setShow28Modal(false);
          }}
        />
      )}

      {/* Conditional Emergency/Vault Banner */}
      {statusData && statusData.isEmergencyCleaned ? (
        <div class="emergency-banner" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.22), rgba(59, 130, 246, 0.18))', borderColor: 'var(--accent-emerald)' }}>
          <div class="emergency-info" style={{ maxWidth: '60%' }}>
            <div class="emergency-badge" style={{ color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.15)', borderColor: 'var(--accent-emerald)' }}>
              <ShieldCheck size={14} />
              <span>Vault Active: 28.25 GB Parked Externally</span>
            </div>
            <h2 class="emergency-title">macOS Update Complete! Data Safely Parked.</h2>
            <p class="emergency-desc">
              Your Mac has <strong>{freeSpaceGB} GB</strong> of free space. The 36.7 GB of offloaded developer caches and logs are safely stored on your <strong>Remote Vault</strong>.
            </p>
          </div>

          <button 
            class="action-btn primary" 
            style={{ padding: '14px 26px', fontSize: '1rem', boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)' }}
            onClick={() => setShow28Modal(true)}
          >
            <Power size={18} />
            <span>Manage / Restore Vault Data</span>
          </button>
        </div>
      ) : (
        <div class="emergency-banner" style={{ background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.22), rgba(139, 92, 246, 0.18))', borderColor: 'var(--accent-rose)' }}>
          <div class="emergency-info" style={{ maxWidth: '60%' }}>
            <div class="emergency-badge">
              <AlertTriangle size={14} />
              <span>macOS 27 Golden Gate Update Alert</span>
            </div>
            <h2 class="emergency-title">Updating Requires at Least 28.25 GB of Space</h2>
            <p class="emergency-desc">
              Your current free space is <strong>{freeSpaceGB} GB</strong>. NebulaVault identified <strong>36.7 GB of safe offloadable data</strong> (Dash 7.3 GB, Google 7.1 GB, Trae 3.7 GB, OpenAI 2.9 GB) locked by background processes.
            </p>
          </div>

          <button 
            class="action-btn danger" 
            style={{ padding: '14px 26px', fontSize: '1rem', boxShadow: '0 8px 24px rgba(244, 63, 94, 0.4)' }}
            onClick={() => setShow28Modal(true)}
          >
            <Power size={18} />
            <span>Unblock 28.25 GB Update Now</span>
          </button>
        </div>
      )}

      {/* Quick Utility Banners (Safari Cache & Duplicate Apps) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div style={{
          background: 'rgba(6, 182, 212, 0.12)',
          border: '1px solid rgba(6, 182, 212, 0.4)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Compass size={22} color="var(--accent-cyan)" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#ffffff' }}>Safari Web Caches</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {safariPurged ? 'Cache Cleaned' : `${safariCacheGB} GB stored in ~/Library/Caches`}
              </div>
            </div>
          </div>

          <button 
            class="action-btn primary"
            style={{ padding: '6px 14px', fontSize: '0.78rem' }}
            onClick={handleSafariPurge}
            disabled={safariPurged}
          >
            <Trash2 size={14} />
            <span>{safariPurged ? 'Purged' : 'Purge Safari Cache'}</span>
          </button>
        </div>

        <div style={{
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Copy size={22} color="var(--accent-amber)" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#ffffff' }}>{duplicateAppsCount} Duplicate Apps Detected</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Antigravity, Trae, Copilot, Chrome Dev duplicates
              </div>
            </div>
          </div>

          <button 
            class="action-btn secondary"
            style={{ padding: '6px 14px', fontSize: '0.78rem' }}
            onClick={() => onNavigateTab('duplicates')}
          >
            <span>Review Duplicates</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-lbl">System Free Disk Space</span>
            <div class="metric-icon-box" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)' }}>
              <HardDrive size={20} />
            </div>
          </div>
          <div class="metric-val" style={{ color: 'var(--accent-emerald)' }}>
            {freeSpaceGB} GB
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Target: 28.25 GB required
          </span>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-lbl">Reclaimable Local Junk</span>
            <div class="metric-icon-box" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)' }}>
              <Layers size={20} />
            </div>
          </div>
          <div class="metric-val">{potentialGB} GB</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Dash, Google, Trae, OpenAI caches
          </span>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-lbl">Total Offloaded (Stubbed)</span>
            <div class="metric-icon-box" style={{ background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)' }}>
              <ArrowUpRight size={20} />
            </div>
          </div>
          <div class="metric-val">{offloadedGB} GB</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {stubsCount} local stubs active
          </span>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-lbl">Active Storage Vaults</span>
            <div class="metric-icon-box" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)' }}>
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div class="metric-val">3 Ready</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            USB-C SSD + Google Drive + S3
          </span>
        </div>
      </div>
    </div>
  );
}
