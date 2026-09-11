import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, Activity, Database, Server, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

export default function SystemPropagatorView() {
  const [redisUrl, setRedisUrl] = useState('');
  const [status, setStatus] = useState({ connected: false, error: null, used_memory: 0, dbSize: 0, url: '' });
  const [connecting, setConnecting] = useState(false);
  const canvasRef = useRef(null);
  const dbSizeRef = useRef(0);
  const connectedRef = useRef(false);

  // Keep refs in sync with state (avoids canvas re-init on every poll)
  useEffect(() => { dbSizeRef.current = status.dbSize; }, [status.dbSize]);
  useEffect(() => { connectedRef.current = status.connected; }, [status.connected]);

  // Polling with AbortController for safe unmount
  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/redis/status`, { signal: controller.signal });
        if (!isMounted) return;
        const data = await res.json();
        setStatus(data);
        if (data.url && !redisUrl) setRedisUrl(data.url);
      } catch (e) {
        if (e.name === 'AbortError') return; // expected on unmount
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);

    return () => {
      isMounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch(`${API_BASE}/redis/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redisUrl })
      });
      const data = await res.json();
      if (data.error) {
        setStatus(prev => ({ ...prev, error: data.error }));
      }
      // Wait briefly for ioredis to establish connection
      setTimeout(async () => {
        try {
          const r = await fetch(`${API_BASE}/redis/status`);
          setStatus(await r.json());
        } catch(e) {}
        setConnecting(false);
      }, 2000);
    } catch (e) {
      setConnecting(false);
    }
  };

  // Smooth Canvas Animation — runs ONCE, reads refs for dynamic data
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];
    let time = 0;

    // Initialize particles
    const count = 40;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 2.5 + 0.5,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        alpha: Math.random() * 0.4 + 0.2,
        hue: Math.random() * 60 + 190 // blue-cyan range
      });
    }

    const render = () => {
      time += 0.01;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const isConnected = connectedRef.current;
      const currentDbSize = dbSizeRef.current;

      // Dynamic particle count based on dbSize (add/remove smoothly)
      const targetCount = isConnected ? Math.min(Math.max(currentDbSize || 20, 20), 120) : 8;
      while (particles.length < targetCount) {
        particles.push({
          x: cx + (Math.random() - 0.5) * 80,
          y: cy + (Math.random() - 0.5) * 80,
          radius: Math.random() * 2 + 0.5,
          vx: (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.5) * 1.2,
          alpha: 0,
          hue: Math.random() * 60 + 190
        });
      }
      while (particles.length > targetCount + 5) {
        particles.pop();
      }

      // Pulsing central core
      const pulseRadius = 28 + Math.sin(time * 2) * 4;
      const glowSize = isConnected ? 60 : 20;

      // Outer glow
      const gradient = ctx.createRadialGradient(cx, cy, pulseRadius, cx, cy, glowSize);
      gradient.addColorStop(0, isConnected ? 'rgba(0, 210, 255, 0.15)' : 'rgba(80, 80, 80, 0.08)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.beginPath();
      ctx.arc(cx, cy, glowSize, 0, 2 * Math.PI);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Core ring
      ctx.beginPath();
      ctx.arc(cx, cy, pulseRadius, 0, 2 * Math.PI);
      ctx.fillStyle = isConnected ? `rgba(0, 210, 255, ${0.12 + Math.sin(time * 3) * 0.05})` : 'rgba(60, 60, 60, 0.15)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = isConnected ? `rgba(0, 210, 255, ${0.6 + Math.sin(time * 2) * 0.3})` : '#444';
      ctx.stroke();

      // Inner pulse dot
      if (isConnected) {
        ctx.beginPath();
        ctx.arc(cx, cy, 4 + Math.sin(time * 4) * 2, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(0, 255, 200, ${0.6 + Math.sin(time * 5) * 0.3})`;
        ctx.fill();
      }

      // Particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        // Soft boundary bounce
        if (p.x < 5 || p.x > canvas.width - 5) p.vx *= -1;
        if (p.y < 5 || p.y > canvas.height - 5) p.vy *= -1;

        // Fade in new particles
        if (p.alpha < 0.5) p.alpha += 0.005;

        // Connection lines to center
        if (isConnected) {
          const dist = Math.hypot(cx - p.x, cy - p.y);
          if (dist < 160) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(cx, cy);
            const lineAlpha = 0.15 * (1 - dist / 160);
            ctx.strokeStyle = `hsla(${p.hue}, 80%, 60%, ${lineAlpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }

        // Particle dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI);
        ctx.fillStyle = isConnected
          ? `hsla(${p.hue}, 70%, 60%, ${p.alpha})`
          : `rgba(80, 80, 80, ${p.alpha * 0.5})`;
        ctx.fill();
      });

      // Labels
      ctx.fillStyle = isConnected ? 'rgba(0, 210, 255, 0.7)' : 'rgba(120, 120, 120, 0.5)';
      ctx.font = '10px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isConnected ? 'REDIS CORE' : 'OFFLINE', cx, cy + pulseRadius + 16);

      if (isConnected && currentDbSize > 0) {
        ctx.fillStyle = 'rgba(0, 210, 255, 0.5)';
        ctx.font = '9px system-ui';
        ctx.fillText(`${currentDbSize} active keys`, cx, cy + pulseRadius + 28);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, []); // Runs ONCE — reads refs for dynamic data

  return (
    <div className="content-area">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ffffff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={26} color="var(--accent-cyan)" />
            AI Memory Health Visualization
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Real-time visualizer mapping hot context frames to remote Redis infrastructure.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left Column: Connection Pane */}
        <div className="card glass-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#fff' }}>
            <Server size={18} /> Remote Redis Link
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Connect to your Upstash or Redis Cloud instance to persist AI session context.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Redis Connection URL</label>
            <input 
              type="text" 
              value={redisUrl}
              onChange={e => setRedisUrl(e.target.value)}
              placeholder="rediss://default:password@endpoint..." 
              style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', width: '100%', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', transition: 'border-color 0.2s', outline: 'none' }}
              onFocus={e => e.target.style.borderColor = 'var(--accent-cyan)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
            <button 
              className={`action-btn ${status.connected ? 'secondary' : 'primary'}`} 
              onClick={handleConnect}
              disabled={connecting || !redisUrl}
              style={{ alignSelf: 'flex-start' }}
            >
              {connecting ? <RefreshCw size={16} className="spin" /> : (status.connected ? <RefreshCw size={16} /> : <Database size={16} />)}
              {connecting ? 'Connecting...' : (status.connected ? 'Reconnect' : 'Establish Link')}
            </button>
          </div>

          <div style={{ padding: '16px', background: 'rgba(0,0,0,0.25)', borderRadius: '10px', borderLeft: status.connected ? '3px solid var(--success-color)' : (status.error ? '3px solid var(--danger-color)' : '3px solid #444'), transition: 'border-color 0.3s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              {status.connected ? <CheckCircle2 size={16} color="var(--success-color)" /> : <Activity size={16} color={status.error ? 'var(--danger-color)' : '#666'} />}
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Connection Status</span>
            </div>
            {status.connected ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '4px' }}>Status</div>
                  <div style={{ color: 'var(--success-color)', fontWeight: 600 }}>● Active & Streaming</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '4px' }}>Memory</div>
                  <div style={{ fontWeight: 600 }}>{(status.used_memory / 1024 / 1024).toFixed(2)} MB</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '4px' }}>AI Contexts</div>
                  <div style={{ fontWeight: 600 }}>{status.dbSize} Keys</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '4px' }}>Endpoint</div>
                  <div style={{ fontWeight: 500, fontSize: '0.8rem', opacity: 0.7 }}>{status.url ? new URL(status.url).hostname : '—'}</div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: status.error ? 'var(--danger-color)' : 'var(--text-muted)' }}>
                {status.error ? `⚠ ${status.error}` : 'Awaiting connection to remote infrastructure...'}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Visualization */}
        <div className="card glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#fff' }}>
            <Database size={18} /> Memory Topography
          </h3>
          <div style={{ flex: 1, minHeight: '300px', background: 'rgba(0,0,0,0.4)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            <canvas ref={canvasRef} width={400} height={300} style={{ width: '100%', height: '100%' }} />
            
            {!status.connected && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', color: '#555', pointerEvents: 'none' }}>
                <Activity size={32} style={{ marginBottom: '8px', opacity: 0.3 }} />
                <div style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>Telemetry Offline</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
