import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose, duration = 4000 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Small delay to trigger animation
    const inTimer = setTimeout(() => setVisible(true), 50);
    const outTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // Wait for fade out
    }, duration);
    
    return () => {
      clearTimeout(inTimer);
      clearTimeout(outTimer);
    };
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle2 size={18} color="var(--accent-emerald)" />,
    error: <AlertTriangle size={18} color="var(--accent-rose)" />,
    info: <Info size={18} color="var(--accent-blue)" />
  };

  return (
    <div style={{
      position: 'fixed',
      top: '24px',
      right: '24px',
      zIndex: 9999,
      background: 'rgba(25, 27, 38, 0.85)',
      backdropFilter: 'blur(20px)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)',
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)',
      width: '340px',
      transform: visible ? 'translateY(0) scale(1)' : 'translateY(-20px) scale(0.95)',
      opacity: visible ? 1 : 0,
      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      pointerEvents: 'auto'
    }}>
      <div style={{ marginTop: '2px' }}>
        {icons[type] || icons.info}
      </div>
      <div style={{ flex: 1 }}>
        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>
          {type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Notification'}
        </h4>
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
          {message}
        </p>
      </div>
      <button 
        onClick={() => { setVisible(false); setTimeout(onClose, 300); }}
        style={{
          background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px'
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
