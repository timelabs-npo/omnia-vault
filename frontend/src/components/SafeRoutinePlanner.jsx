import React, { useState } from 'react';
import { Shield, Clock, Link2, Check, Save, Sliders, ToggleRight } from 'lucide-react';

export default function SafeRoutinePlanner({ routineSchema }) {
  const [saved, setSaved] = useState(false);
  const [stubFormat, setStubFormat] = useState(routineSchema ? routineSchema.stubFormat : '.vault-link (0-Byte JSON Pointer)');
  const [dryRun, setDryRun] = useState(true);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div class="content-area" style={{ maxWidth: '800px' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Shield size={22} color="var(--accent-emerald)" />
          Safe Daily Routine Planner & Storage Link Schemas
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
              Storage Link Stub Schema (Dehydration Topology)
            </label>
            <select 
              value={stubFormat}
              onChange={(e) => setStubFormat(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.3)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem'
              }}
            >
              <option value=".vault-link (0-Byte JSON Pointer)">.vault-link (0-Byte JSON Pointer with metadata)</option>
              <option value="macOS Bookmark Pointer (Cryptex compatible)">macOS Bookmark Pointer (Cryptex compatible)</option>
              <option value="Relative Symlink Pointer">Relative Symlink Pointer (ln -s target)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Dry-Run Simulation Safety Check</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Simulates space savings and log entries before executing any physical file movements</div>
            </div>
            <label class="switch">
              <input type="checkbox" checked={dryRun} onChange={() => setDryRun(!dryRun)} />
              <span class="slider"></span>
            </label>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
              Daily AutoClean Schedule Execution Time
            </label>
            <input 
              type="text" 
              defaultValue="04:00 AM Daily" 
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.3)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem'
              }}
            />
          </div>

          <button class="action-btn primary" onClick={handleSave} style={{ alignSelf: 'flex-start' }}>
            {saved ? <Check size={16} /> : <Save size={16} />}
            <span>{saved ? 'Schema Planner Saved!' : 'Save Routine Schema'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
