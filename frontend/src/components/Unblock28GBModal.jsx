import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, X, Zap, HardDrive, CheckCircle2, ArrowRight } from 'lucide-react';

export default function Unblock28GBModal({ onClose, onConfirmUnblock, onConfirmRestore, isRestoreMode }) {
  const [executing, setExecuting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const handleExecute = async () => {
    setExecuting(true);
    if (isRestoreMode && onConfirmRestore) {
      await onConfirmRestore();
    } else if (onConfirmUnblock) {
      await onConfirmUnblock();
    }
    setExecuting(false);
    setCompleted(true);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: '#161824',
        border: '1px solid rgba(244, 63, 94, 0.5)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: '600px',
        padding: '28px',
        boxShadow: '0 25px 60px -15px rgba(244, 63, 94, 0.3)',
        position: 'relative'
      }}>
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '18px', right: '18px',
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            color: 'var(--text-secondary)',
            borderRadius: '50%',
            width: '32px', height: '32px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <X size={16} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
          <div style={{
            width: '46px', height: '46px',
            borderRadius: 'var(--radius-md)',
            background: isRestoreMode ? 'rgba(16, 185, 129, 0.18)' : 'rgba(244, 63, 94, 0.18)',
            color: isRestoreMode ? 'var(--accent-emerald)' : 'var(--accent-rose)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {isRestoreMode ? <ShieldCheck size={26} /> : <AlertTriangle size={26} />}
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
              {isRestoreMode ? '1-Click Vault Restoration' : '28.25 GB macOS Update Unblocker'}
            </h2>
            <span style={{ fontSize: '0.78rem', color: isRestoreMode ? 'var(--accent-cyan)' : 'var(--accent-amber)', fontWeight: 600 }}>
              {isRestoreMode ? 'Hydrating from: Remote Vault' : 'Target: macOS 27 Golden Gate Developer Beta Update'}
            </span>
          </div>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          lineHeight: '1.5',
          marginBottom: '20px'
        }}>
          {isRestoreMode 
            ? <span>Your macOS update is complete! NebulaVault will now hydrate the following 0-byte stubs by pulling the full files back from your <strong style={{ color: 'var(--accent-emerald)' }}>External SSD Vault</strong>:</span>
            : <span>System update requires <strong style={{ color: 'var(--accent-rose)' }}>28.25 GB free space</strong>. NebulaVault will flush stale system logs and offload heavy Application Support caches into your External SSD Vault while leaving 0-byte local stubs:</span>
          }
        </div>

        {/* Action Preset Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
            <div>
              <strong style={{ fontSize: '0.85rem', color: '#ffffff' }}>{isRestoreMode ? 'Restore Dash Docsets Cache' : 'Offload Dash Docsets Cache'}</strong>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {isRestoreMode ? 'External SSD Vault → ~/Library/Application Support/Dash' : '~/Library/Application Support/Dash → External SSD Vault'}
              </div>
            </div>
            <span style={{ fontWeight: 700, color: isRestoreMode ? 'var(--accent-cyan)' : 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>{isRestoreMode ? '7.3 GB' : '+7.3 GB'}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
            <div>
              <strong style={{ fontSize: '0.85rem', color: '#ffffff' }}>{isRestoreMode ? 'Restore Google Web & Drive Caches' : 'Offload Google Web & Drive Caches'}</strong>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {isRestoreMode ? 'External SSD Vault → ~/Library/Application Support/Google' : '~/Library/Application Support/Google → External SSD Vault'}
              </div>
            </div>
            <span style={{ fontWeight: 700, color: isRestoreMode ? 'var(--accent-cyan)' : 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>{isRestoreMode ? '7.1 GB' : '+7.1 GB'}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
            <div>
              <strong style={{ fontSize: '0.85rem', color: '#ffffff' }}>{isRestoreMode ? 'Restore TRAE SOLO App Cache' : 'Offload TRAE SOLO App Cache'}</strong>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {isRestoreMode ? 'Vault → ~/Library/Application Support/TRAE SOLO' : '~/Library/Application Support/TRAE SOLO → Vault'}
              </div>
            </div>
            <span style={{ fontWeight: 700, color: isRestoreMode ? 'var(--accent-cyan)' : 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>{isRestoreMode ? '3.7 GB' : '+3.7 GB'}</span>
          </div>

          {!isRestoreMode && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <strong style={{ fontSize: '0.85rem', color: '#ffffff' }}>Flush System Diagnostic Logs & Hermes Cache</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>~/Library/Logs + ~/.hermes</div>
              </div>
              <span style={{ fontWeight: 700, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>+4.8 GB</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.82rem', color: isRestoreMode ? 'var(--accent-cyan)' : 'var(--accent-emerald)', fontWeight: 700 }}>
            {isRestoreMode ? 'Total Vault Hydration: 18.1 GB' : 'Total Projected Free Space: 33.3 GB'}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button class="action-btn secondary" onClick={onClose}>
              Cancel
            </button>
            <button 
              class={`action-btn ${isRestoreMode ? 'primary' : 'danger'}`}
              onClick={handleExecute}
              disabled={executing || completed}
              style={{ padding: '10px 20px', background: isRestoreMode && !completed ? 'var(--accent-blue)' : undefined }}
            >
              {completed ? <CheckCircle2 size={16} /> : (isRestoreMode ? <HardDrive size={16} /> : <Zap size={16} />)}
              <span>{completed 
                ? (isRestoreMode ? 'Restoration Complete!' : '28.25 GB Unblocked!') 
                : executing 
                  ? (isRestoreMode ? 'Hydrating...' : 'Unblocking...') 
                  : (isRestoreMode ? 'Hydrate 28.25 GB Back to Mac' : 'Execute 28.25 GB Preset')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
