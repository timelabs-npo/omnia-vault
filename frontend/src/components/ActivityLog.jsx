import React from 'react';
import { Terminal, Download, Copy, Trash2, CheckCircle2 } from 'lucide-react';

export default function ActivityLog({ logs }) {
  const copyLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    alert('log.0 content copied to clipboard!');
  };

  return (
    <div class="content-area">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={18} color="var(--accent-emerald)" />
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Structured Event Feed (`.nebulavault.log.0`)</h2>
        </div>

        <button class="action-btn secondary" onClick={copyLogs} style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
          <Copy size={14} />
          <span>Copy log.0</span>
        </button>
      </div>

      <div class="log-stream">
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>Waiting for storage engine events...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} class="log-entry">
              <span class="log-timestamp">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
              <span class={`log-tag ${log.level}`}>[{log.level}]</span>
              <span>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
