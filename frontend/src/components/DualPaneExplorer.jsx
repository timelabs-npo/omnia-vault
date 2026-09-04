import React, { useState } from 'react';
import { HardDrive, ArrowRight, ArrowLeft, Cloud, CheckSquare, Square, FileText, Image, Download, Code, Layers, FileCheck, RefreshCw, Sparkles } from 'lucide-react';

export default function DualPaneExplorer({ files, onOffloadFiles, onHydrateFile, loading }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [targetVault, setTargetVault] = useState('Remote Vault');

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(item => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const selectAllLocal = () => {
    const unstubbed = files.filter(f => !f.stubbed).map(f => f.id);
    setSelectedIds(unstubbed);
  };

  const filteredFiles = files.filter(f => {
    if (categoryFilter === 'all') return true;
    return f.category === categoryFilter;
  });

  const localFiles = filteredFiles.filter(f => !f.stubbed);
  const stubbedFiles = filteredFiles.filter(f => f.stubbed);

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case 'screenshots': return <Image size={16} color="var(--accent-amber)" />;
      case 'downloads': return <Download size={16} color="var(--accent-blue)" />;
      case 'cache': return <Layers size={16} color="var(--accent-rose)" />;
      case 'developer': return <Code size={16} color="var(--accent-purple)" />;
      default: return <FileText size={16} color="var(--text-secondary)" />;
    }
  };

  const formatSize = (bytes) => {
    if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB';
    return (bytes / 1e6).toFixed(1) + ' MB';
  };

  return (
    <div class="content-area">
      {/* Top Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Filter by Type:</span>
          {['all', 'screenshots', 'downloads', 'cache', 'developer'].map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              class={`action-btn ${categoryFilter === cat ? 'primary' : 'secondary'}`}
              style={{ padding: '4px 12px', fontSize: '0.78rem', textTransform: 'capitalize' }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Target Vault:</span>
          <select 
            value={targetVault} 
            onChange={(e) => setTargetVault(e.target.value)}
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8rem',
              outline: 'none'
            }}
          >
            <option value="Remote Vault">Remote Vault</option>
            <option value="Google Drive Enterprise Vault">Google Drive Enterprise</option>
            <option value="AWS S3 Glacier Archive">AWS S3 Glacier Archive</option>
          </select>
        </div>
      </div>

      {/* ForkLift Dual Pane Container */}
      <div class="dual-pane-wrapper">
        {/* Left Pane: macOS Local Filesystem */}
        <div class="pane">
          <div class="pane-header">
            <div class="pane-title">
              <HardDrive size={18} color="var(--accent-blue)" />
              <span>macOS Local Disk (Active Files)</span>
            </div>
            <div class="pane-sub">
              {localFiles.length} items • {(localFiles.reduce((a,b)=>a+b.size,0)/1e9).toFixed(2)} GB
            </div>
          </div>

          <div class="file-list">
            {localFiles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <Sparkles size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                <p>All local files in this view have been offloaded & stubbed!</p>
              </div>
            ) : (
              localFiles.map(file => {
                const isSelected = selectedIds.includes(file.id);
                return (
                  <div 
                    key={file.id} 
                    class={`file-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleSelect(file.id)}
                  >
                    <div style={{ color: isSelected ? 'var(--accent-blue)' : 'var(--text-muted)' }}>
                      {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    </div>

                    <div class="file-icon">
                      {getCategoryIcon(file.category)}
                    </div>

                    <div class="file-details">
                      <div class="file-name">{file.name}</div>
                      <div class="file-meta">
                        <span>{formatSize(file.size)}</span>
                        <span>•</span>
                        <span>{file.path}</span>
                        <span>•</span>
                        <span>Modified: {file.modified}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div class="pane-footer">
            <button class="action-btn secondary" style={{ fontSize: '0.78rem' }} onClick={selectAllLocal}>
              Select All ({localFiles.length})
            </button>

            <button 
              class="action-btn primary"
              disabled={selectedIds.length === 0 || loading}
              onClick={() => {
                onOffloadFiles(selectedIds, targetVault);
                setSelectedIds([]);
              }}
            >
              <span>Offload & Stub Selected ({selectedIds.length})</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Right Pane: Vault Offload Facility (Stubbed / External) */}
        <div class="pane">
          <div class="pane-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div class="pane-title">
                <Cloud size={18} color="var(--accent-cyan)" />
                <span>External Vault & Stubs ({targetVault})</span>
              </div>
              <button 
                class="action-btn secondary" 
                style={{ padding: '4px 10px', fontSize: '0.75rem', height: '24px' }}
                onClick={() => {
                  fetch('/api/open-remote-vault', { method: 'POST' })
                    .then(r => r.json())
                    .then(data => alert(`Opening remote directory: ${data.path}`))
                    .catch(e => alert(e.message));
                }}
              >
                Open Remote Directory
              </button>
            </div>
            <div class="pane-sub">
              {stubbedFiles.length} offloaded • {(stubbedFiles.reduce((a,b)=>a+b.size,0)/1e9).toFixed(2)} GB saved
            </div>
          </div>

          <div class="file-list">
            {stubbedFiles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <Cloud size={32} style={{ marginBottom: '8px', opacity: 0.4 }} />
                <p>No offloaded files in this category yet. Select items on the left and click "Offload & Stub".</p>
              </div>
            ) : (
              stubbedFiles.map(file => (
                <div key={file.id} class="file-row stubbed">
                  <div class="file-icon" style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-cyan)' }}>
                    {getCategoryIcon(file.category)}
                  </div>

                  <div class="file-details">
                    <div class="file-name">
                      {file.name}
                      <span class="stub-badge">0-Byte Stub Pointer</span>
                    </div>
                    <div class="file-meta">
                      <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{formatSize(file.size)} saved</span>
                      <span>•</span>
                      <span>Vault: {file.targetVault}</span>
                    </div>
                  </div>

                  <button 
                    class="action-btn secondary"
                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                    onClick={() => onHydrateFile(file.id)}
                    title="1-Click Download back to macOS local storage"
                  >
                    <ArrowLeft size={14} />
                    <span>Hydrate (Restore)</span>
                  </button>
                </div>
              ))
            )}
          </div>

          <div class="pane-footer" style={{ justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              1-Click Hydration returns full file contents to local macOS disk seamlessly.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
