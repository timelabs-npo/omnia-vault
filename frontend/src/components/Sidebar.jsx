import React from 'react';
import { LayoutDashboard, HardDrive, ShieldCheck, Terminal, Settings, Disc, Copy, Image, Shield, Zap, Wand2, Cloud } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, statusData }) {
  const freeGB = statusData ? statusData.macSystemFreeGB : 4.12;
  const offloadedGB = statusData ? statusData.totalOffloadedGB : 24.5;
  const usedPercent = Math.min(100, Math.round(((256 - freeGB) / 256) * 100));

  return (
    <aside class="sidebar">
      {/* Brand Header */}
      <div class="app-brand">
        <div class="brand-icon">
          <Zap size={20} color="#ffffff" />
        </div>
        <div>
          <h1 class="brand-name">NebulaVault</h1>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '-2px' }}>
            macOS Swift & Studio Suite
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <div class="nav-section-title">Core Management</div>

      <div 
        class={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => setActiveTab('dashboard')}
      >
        <LayoutDashboard size={18} />
        <span>Storage Overview</span>
      </div>

      <div 
        class={`nav-item ${activeTab === 'disklens' ? 'active' : ''}`}
        onClick={() => setActiveTab('disklens')}
      >
        <Disc size={18} />
        <span>Disk Lens UI</span>
      </div>

      <div 
        class={`nav-item ${activeTab === 'explorer' ? 'active' : ''}`}
        onClick={() => setActiveTab('explorer')}
      >
        <HardDrive size={18} />
        <span>External Vault</span>
      </div>

      <div 
        class={`nav-item ${activeTab === 'optimize' ? 'active' : ''}`}
        onClick={() => setActiveTab('optimize')}
      >
        <Wand2 size={18} />
        <span>System Optimize</span>
      </div>

      <div class="nav-section-title">AI Integrations</div>

      <div 
        class={`nav-item ${activeTab === 'propagator' ? 'active' : ''}`}
        onClick={() => setActiveTab('propagator')}
      >
        <Zap size={18} color={activeTab === 'propagator' ? 'var(--accent-cyan)' : 'inherit'} />
        <span>System Propagator</span>
      </div>

      <div class="nav-section-title">Smart Cleaners</div>

      <div 
        class={`nav-item ${activeTab === 'cloud' ? 'active' : ''}`}
        onClick={() => setActiveTab('cloud')}
      >
        <Cloud size={18} />
        <span>Cloud Storage Audit</span>
      </div>

      <div 
        class={`nav-item ${activeTab === 'duplicates' ? 'active' : ''}`}
        onClick={() => setActiveTab('duplicates')}
      >
        <Copy size={18} />
        <span>Duplicate Finder</span>
      </div>

      <div 
        class={`nav-item ${activeTab === 'screenshots' ? 'active' : ''}`}
        onClick={() => setActiveTab('screenshots')}
      >
        <Image size={18} />
        <span>Google Drive Screenshots</span>
      </div>

      <div 
        class={`nav-item ${activeTab === 'routine' ? 'active' : ''}`}
        onClick={() => setActiveTab('routine')}
      >
        <Shield size={18} />
        <span>Safe Routine Planner</span>
      </div>

      <div 
        class={`nav-item ${activeTab === 'rules' ? 'active' : ''}`}
        onClick={() => setActiveTab('rules')}
      >
        <ShieldCheck size={18} />
        <span>Daily AutoClean</span>
      </div>

      <div 
        class={`nav-item ${activeTab === 'activity' ? 'active' : ''}`}
        onClick={() => setActiveTab('activity')}
      >
        <Terminal size={18} />
        <span>Transparent Log.0</span>
      </div>

      <div class="sidebar-spacer"></div>

      {/* Connected Vault Status */}
      <div class="sidebar-storage-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', marginBottom: '4px' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Macintosh HD</span>
          <span style={{ color: 'var(--accent-rose)', fontWeight: 700 }}>{freeGB} GB free</span>
        </div>
        <div class="storage-bar-bg">
          <div class="storage-bar-fill" style={{ width: `${usedPercent}%` }}></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <span>Offloaded: <strong style={{ color: 'var(--accent-cyan)' }}>{offloadedGB} GB</strong></span>
          <span>Cap: 256 GB</span>
        </div>
      </div>

      <div 
        class="nav-item" 
        style={{ marginTop: '12px' }}
        onClick={() => setActiveTab('settings')}
      >
        <Settings size={18} />
        <span>App Settings</span>
      </div>
    </aside>
  );
}
