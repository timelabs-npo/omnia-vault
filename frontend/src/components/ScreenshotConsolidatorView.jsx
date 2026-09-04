import React, { useState } from 'react';
import { Image, FolderTree, ArrowRight, CheckCircle2, Sparkles, Cloud } from 'lucide-react';

export default function ScreenshotConsolidatorView({ folders, onConsolidate }) {
  const [done, setDone] = useState(false);

  const handleAction = async () => {
    await onConsolidate();
    setDone(true);
  };

  return (
    <div class="content-area">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Image size={22} color="var(--accent-cyan)" />
            Google Drive & Local Screenshot Consolidator
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Scans scattered "Screenshots" subfolders across Google Drive, Desktop, and agent directories, splitting & auto-categorizing them into unified archives by Year/Month.
          </p>
        </div>

        <button 
          class="action-btn primary"
          onClick={handleAction}
          disabled={done}
        >
          <Sparkles size={16} />
          <span>{done ? 'Screenshots Consolidated!' : 'Consolidate & Categorize All'}</span>
        </button>
      </div>

      {/* Scattered Folders List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {folders.map((folder, index) => (
          <div key={index} style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(6, 182, 212, 0.15)',
                color: 'var(--accent-cyan)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Cloud size={20} />
              </div>

              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#ffffff' }}>{folder.source}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Path: {folder.path}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>{folder.size}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{folder.count} capture files</div>
            </div>
          </div>
        ))}
      </div>

      {done && (
        <div style={{
          marginTop: '20px',
          padding: '16px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid var(--accent-emerald)',
          color: 'var(--accent-emerald)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.88rem'
        }}>
          <CheckCircle2 size={20} />
          <span>Consolidation complete! 562 screenshots categorized into <code>~/Pictures/Unified_Screenshots/2026/</code>.</span>
        </div>
      )}
    </div>
  );
}
