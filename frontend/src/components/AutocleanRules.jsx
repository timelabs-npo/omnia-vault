import React from 'react';
import { ShieldCheck, Play, Clock, CheckCircle, Zap, Image, Layers, Download, Code, Bell } from 'lucide-react';

export default function AutocleanRules({ rules, onToggleRule, onEmergencyClean, loading }) {
  return (
    <div class="content-area">
      {/* Active Daemon Header */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(16, 185, 129, 0.15)',
            color: 'var(--accent-emerald)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
              Visible Daily AutoClean Manager
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Transparent daemon active • Next scheduled sweep in <strong>3h 42m</strong> • Not a silent background blackbox.
            </p>
          </div>
        </div>

        <button 
          class="action-btn primary"
          onClick={onEmergencyClean}
          disabled={loading}
        >
          <Play size={16} />
          <span>Run All Rules Now</span>
        </button>
      </div>

      {/* Rules list */}
      <div class="rules-container">
        {rules.map(rule => (
          <div key={rule.id} class="rule-card">
            <div class="rule-info">
              <div class="rule-icon">
                {rule.category === 'screenshots' && <Image size={22} color="var(--accent-amber)" />}
                {rule.category === 'cache' && <Layers size={22} color="var(--accent-rose)" />}
                {rule.category === 'downloads' && <Download size={22} color="var(--accent-blue)" />}
                {rule.category === 'developer' && <Code size={22} color="var(--accent-purple)" />}
              </div>

              <div>
                <div class="rule-title">{rule.title}</div>
                <div class="rule-desc">
                  Schedule: <strong>{rule.frequency}</strong> • Target Vault: <span style={{ color: 'var(--accent-cyan)' }}>{rule.targetVault}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <span style={{
                fontSize: '0.75rem',
                padding: '4px 10px',
                borderRadius: '12px',
                background: rule.enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                color: rule.enabled ? 'var(--accent-emerald)' : 'var(--text-muted)',
                fontWeight: 600
              }}>
                {rule.enabled ? 'ACTIVE' : 'PAUSED'}
              </span>

              <label class="switch">
                <input 
                  type="checkbox" 
                  checked={rule.enabled} 
                  onChange={() => onToggleRule(rule.id)}
                />
                <span class="slider"></span>
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
