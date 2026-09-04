import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, FolderSync, AlertTriangle, Eye, Zap, Search, RefreshCw, Trash2, HardDrive } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

export default function CloudSyncMonitorView() {
  const [activeProvider, setActiveProvider] = useState('all');
  const [cloudData, setCloudData] = useState({ files: [], stats: { downloadedGB: '0', datalessGB: '0', suspiciousGB: '0', downloadedCount: 0, datalessCount: 0, suspiciousCount: 0 } });
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [evicting, setEvicting] = useState(null);

  const scanCloud = async () => {
    setScanning(true);
    try {
      const res = await fetch(`${API_BASE}/cloud/scan`);
      if (res.ok) {
        const data = await res.json();
        setCloudData(data);
      }
    } catch (e) {
      console.error('Cloud scan failed:', e);
    }
    setScanning(false);
  };

  useEffect(() => { scanCloud(); }, []);

  const handleEvict = async (filePath) => {
    setEvicting(filePath);
    try {
      const res = await fetch(`${API_BASE}/cloud/evict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });
      if (res.ok) {
        await scanCloud(); // refresh
      }
    } catch (e) {
      console.error('Eviction failed:', e);
    }
    setEvicting(null);
  };

  const filteredFiles = activeProvider === 'all' 
    ? cloudData.files 
    : cloudData.files.filter(f => f.provider?.toLowerCase().includes(activeProvider));

  const formatSize = (bytes) => {
    if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    return `${(bytes / 1e6).toFixed(0)} MB`;
  };

  return (
    <div className="content-area">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Cloud size={24} color="var(--accent-cyan)" />
            Cloud Storage Hydration Monitor
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Control what is physically taking up SSD space vs. what is stored as a cloud stub ("Dataless")
          </p>
        </div>
        <button className="action-btn secondary" onClick={scanCloud} disabled={scanning}>
          <RefreshCw size={16} className={scanning ? 'spin' : ''} />
          {scanning ? 'Scanning...' : 'Rescan'}
        </button>
      </div>

      {/* Provider Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {[
          { key: 'all', label: 'All Providers', icon: <HardDrive size={14} /> },
          { key: 'icloud', label: 'iCloud Drive', icon: <Cloud size={14} /> },
          { key: 'google', label: 'Google Drive', icon: <FolderSync size={14} /> }
        ].map(tab => (
          <button 
            key={tab.key}
            className={`action-btn ${activeProvider === tab.key ? 'primary' : 'secondary'}`}
            onClick={() => setActiveProvider(tab.key)}
            style={{ fontSize: '0.82rem' }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="card glass-card" style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Physically Downloaded</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--primary-color)' }}>{cloudData.stats.downloadedGB} GB</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>{cloudData.stats.downloadedCount} files consuming SSD</div>
        </div>
        <div className="card glass-card" style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Stored Invisibly</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--success-color)' }}>{cloudData.stats.datalessGB} GB</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>{cloudData.stats.datalessCount} files, 0 bytes on disk</div>
        </div>
        <div className="card glass-card" style={{ textAlign: 'center', padding: '20px', borderColor: parseFloat(cloudData.stats.suspiciousGB) > 0 ? 'var(--danger-color)' : undefined }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Suspicious Caches</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--danger-color)' }}>{cloudData.stats.suspiciousGB} GB</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>{cloudData.stats.suspiciousCount} dev caches synced by mistake</div>
        </div>
      </div>

      {/* File List */}
      <div className="card glass-card">
        <h3 style={{ color: '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={16} /> Scanned Cloud Files
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '16px' }}>
          {filteredFiles.length === 0 
            ? (scanning ? 'Scanning filesystem...' : 'No cloud files found matching criteria. Try rescanning.')
            : `${filteredFiles.length} files found (>50MB) across cloud storage directories`
          }
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredFiles.map(file => (
            <div 
              key={file.id} 
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.05)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.35)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.2)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                {file.status === 'downloaded' ? (
                  <Cloud size={18} color="var(--primary-color)" />
                ) : (
                  <CloudOff size={18} color="var(--text-muted)" style={{ opacity: 0.5 }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                    {file.warning && <AlertTriangle size={13} color="var(--danger-color)" />}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.provider} • <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>{file.path}</span> • <span style={{ fontWeight: 600 }}>{file.sizeHuman}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                {file.status === 'downloaded' ? (
                  <button 
                    className="action-btn secondary" 
                    onClick={() => handleEvict(file.path)}
                    disabled={evicting === file.path}
                    style={{ fontSize: '0.78rem' }}
                  >
                    {evicting === file.path ? <RefreshCw size={13} className="spin" /> : <CloudOff size={13} />}
                    {evicting === file.path ? 'Evicting...' : 'Evict (brctl)'}
                  </button>
                ) : (
                  <span style={{ fontSize: '0.78rem', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Eye size={12} /> Stored Invisibly
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
