import React from 'react';
import { ShieldCheck, Info, X, Zap, Code2, RefreshCcw, CheckCircle2 } from 'lucide-react';

export default function DerivedDataModal({ onClose, onConfirmClean }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: '#181a26',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: '560px',
        padding: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
        position: 'relative'
      }}>
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px', right: '16px',
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            color: 'var(--text-secondary)',
            borderRadius: '50%',
            width: '30px', height: '30px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <X size={16} />
        </button>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{
            width: '42px', height: '42px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(139, 92, 246, 0.15)',
            color: 'var(--accent-purple)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Code2 size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}>
              Xcode DerivedData Safety Inspector
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={14} /> 100% Safe to Clean • Regenerable Build Indexes
            </span>
          </div>
        </div>

        {/* Detailed Safety Information */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '14px',
          fontSize: '0.83rem',
          color: 'var(--text-secondary)',
          lineHeight: '1.5',
          marginBottom: '16px'
        }}>
          <strong style={{ color: '#ffffff', display: 'block', marginBottom: '4px' }}>What is Xcode DerivedData?</strong>
          DerivedData contains intermediate build objects, pre-compiled header files, and Spotlight search indexes generated automatically by Xcode whenever you compile code.
          <ul style={{ marginTop: '8px', paddingLeft: '18px', color: 'var(--text-muted)' }}>
            <li><strong style={{ color: 'var(--accent-emerald)' }}>Source Code Safety:</strong> Your project source files are located in your repositories and are <strong>100% untouched</strong>.</li>
            <li><strong style={{ color: 'var(--accent-cyan)' }}>Auto-Regeneration:</strong> When you open Xcode next time, Xcode rebuilds DerivedData seamlessly in the background.</li>
            <li><strong style={{ color: 'var(--accent-amber)' }}>Reclaimable Space:</strong> Frees <strong>19.9 GB</strong> of stale build cache from previous builds.</li>
          </ul>
        </div>

        {/* Project Breakdown */}
        <div style={{ marginBottom: '20px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
            DerivedData Target Folders to Clean:
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)' }}>
              <span>~/Library/Developer/Xcode/DerivedData/NebulaVault-ax92/</span>
              <strong style={{ color: 'var(--accent-purple)' }}>8.4 GB</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)' }}>
              <span>~/Library/Developer/Xcode/DerivedData/AppStoreBuilds-kp12/</span>
              <strong style={{ color: 'var(--accent-purple)' }}>7.1 GB</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)' }}>
              <span>~/Library/Developer/Xcode/DerivedData/ModuleCache.noindex/</span>
              <strong style={{ color: 'var(--accent-purple)' }}>4.4 GB</strong>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button class="action-btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            class="action-btn primary"
            onClick={() => {
              onConfirmClean();
              onClose();
            }}
          >
            <Zap size={16} />
            <span>Safely Clean 19.9 GB DerivedData</span>
          </button>
        </div>
      </div>
    </div>
  );
}
