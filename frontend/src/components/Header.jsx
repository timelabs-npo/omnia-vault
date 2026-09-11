import React from 'react';
import { AlertCircle, RefreshCw, Zap, Download } from 'lucide-react';

export default function Header({ activeTab, onEmergencyClean, loading, onRefresh, statusData }) {
  const titles = {
    dashboard: 'Storage Diagnostics & Emergency Reclaimer',
    explorer: 'ForkLift Dual-Pane Storage & Hydration Explorer',
    rules: 'Daily AutoClean & Offload Rule Manager',
    activity: 'Transparent Log.0 Real-time Stream',
    settings: 'App Store Candidate Preferences'
  };

  return (
    <header class="top-header">
      <div class="header-title">
        <span>{titles[activeTab] || 'NebulaVault macOS'}</span>
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button 
          class="action-btn secondary"
          onClick={onRefresh}
          title="Rescan Local Volumes & Vaults"
        >
          <RefreshCw size={14} class={loading ? 'spin' : ''} />
          <span>Rescan</span>
        </button>

        {statusData && parseFloat(statusData.macSystemFreeGB) < 10.0 && (
          <button 
            class="action-btn danger"
            onClick={onEmergencyClean}
            disabled={loading}
          >
            <Zap size={14} />
            <span>Emergency Free Space</span>
          </button>
        )}
      </div>
    </header>
  );
}
