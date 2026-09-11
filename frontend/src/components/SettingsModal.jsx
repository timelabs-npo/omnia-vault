import React, { useState } from 'react';
import { Settings, Cloud, HardDrive, Database, Shield, Save, Check } from 'lucide-react';

export default function SettingsModal() {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div class="content-area" style={{ maxWidth: '800px' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Settings size={20} color="var(--accent-purple)" />
          NebulaVault Preferences & Vault Facilities
        </h2>

        {/* Cloud Facilities */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cloud size={16} />
            Cloud Storage Connectors
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Google Drive API Key / Token Path
              </label>
              <input 
                type="text" 
                defaultValue="~/Library/Application Support/NebulaVault/gdrive-token.json" 
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                AWS S3 Glacier Archive Bucket Endpoint
              </label>
              <input 
                type="text" 
                defaultValue="s3://my-mac-glacier-vault.s3.us-west-2.amazonaws.com" 
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem'
                }}
              />
            </div>
          </div>
        </div>

        {/* Database & Log.0 backend */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--accent-emerald)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={16} />
            Telemetry & Teleport Indexing (Redis / CockroachDB / Log.0)
          </h3>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Local Log.0 Output File
            </label>
            <input 
              type="text" 
              defaultValue="~/.nebulavault.log.0" 
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem'
              }}
            />
          </div>
        </div>

        <button class="action-btn primary" onClick={handleSave}>
          {saved ? <Check size={16} /> : <Save size={16} />}
          <span>{saved ? 'Preferences Saved!' : 'Save Configuration'}</span>
        </button>
      </div>
    </div>
  );
}
