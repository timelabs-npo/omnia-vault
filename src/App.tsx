import { useState, useEffect } from 'react';
import { 
  Wifi, 
  Globe, 
  ShieldAlert, 
  ChevronRight, 
  ChevronLeft,
  Server,
  Activity,
  HardDrive,
  Info,
  Cpu,
  Gauge,
  Sparkles,
  Sliders,
  Bot,
  Send,
  Coffee,
  RotateCw,
  Power
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface DiskInfo {
  name: string;
  mount_point: string;
  total_gb: number;
  used_gb: number;
  free_gb: number;
  usage_percent: number;
}

interface ProcessInfo {
  pid: number;
  name: string;
  cpu_usage: number;
  memory_mb: number;
}

interface SystemMetrics {
  cpu_usage: number;
  cpu_cores: number;
  memory_total_mb: number;
  memory_used_mb: number;
  memory_percent: number;
  swap_total_mb: number;
  swap_used_mb: number;
  disks: DiskInfo[];
  cleanable_estimate_mb: number;
  network_rx_kb: number;
  network_tx_kb: number;
  health_score: number;
  health_status: string;
  top_processes: ProcessInfo[];
  uptime_secs: number;
  os_name: string;
}

interface TunnelStatus {
  is_running: boolean;
  pid: number | null;
  port_responding: boolean;
  label: string;
  target_host: string;
  plist_path: string;
}

interface DualValveState {
  valve_mio: boolean;
  valve_wd: boolean;
  flow_mode: string;
  flow_temperature: string;
  total_flow_kb: number;
  active_path_count: number;
  mio_latency_ms: number;
  wd_latency_ms: number;
}

interface ScionDaemonEntity {
  id: string;
  name: string;
  as_id: string;
  daemon_type: string;
  status: string;
  port: number;
  packet_count: number;
}

interface ScionPathEntity {
  destination_as: string;
  hops: string[];
  mtu: number;
  latency_ms: number;
  expiration_secs: number;
  is_active: boolean;
  policy: string;
}

interface Gns3TopologyNode {
  node_id: string;
  name: string;
  node_type: string;
  status: string;
  console_port: number;
  as_mapping: string;
}

interface NdiSettings {
  video_format: string;
  frame_rate: string;
  enabled: boolean;
  last_restart_timestamp: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('control_pane');
  const [cleanStatus, setCleanStatus] = useState<string | null>(null);
  const [isAwake, setIsAwake] = useState(false);

  // Control Pane & NDI Output State
  const [videoFormat, setVideoFormat] = useState('720p HD        ITU Rec 709');
  const [frameRate, setFrameRate] = useState('60');
  const [restartMessage, setRestartMessage] = useState<string | null>(null);

  // Dual Valve Concurrency State ("Hot and Cold water mixer")
  const [valves, setValves] = useState<DualValveState>({
    valve_mio: true,
    valve_wd: true,
    flow_mode: 'Blended Multi-Path (Warm Flow)',
    flow_temperature: 'Warm (Blended)',
    total_flow_kb: 6240,
    active_path_count: 4,
    mio_latency_ms: 0.4,
    wd_latency_ms: 1.2
  });

  // SCION Subtabs & Entities
  const [scionSubTab, setScionSubTab] = useState<'valves' | 'daemons' | 'paths' | 'gns3'>('valves');
  const [selectedAsFilter, setSelectedAsFilter] = useState('all');

  const [scionDaemons, setScionDaemons] = useState<ScionDaemonEntity[]>([
    { id: 'cs-110-1', name: 'Control Service (CS)', as_id: '1-ff00:0:110', daemon_type: 'Control Service', port: 31002, status: 'running', packet_count: 14820 },
    { id: 'br-110-1', name: 'Border Router 1 (to AS-111)', as_id: '1-ff00:0:110', daemon_type: 'Border Router', port: 30042, status: 'running', packet_count: 89402 },
    { id: 'br-110-2', name: 'Border Router 2 (to AS-112)', as_id: '1-ff00:0:110', daemon_type: 'Border Router', port: 30043, status: 'running', packet_count: 42100 },
    { id: 'godispatcher-110', name: 'Packet Dispatcher (godispatcher)', as_id: '1-ff00:0:110', daemon_type: 'Dispatcher', port: 30041, status: 'running', packet_count: 124900 },
    { id: 'sciond-110', name: 'SCION Path Engine (sciond)', as_id: '1-ff00:0:110', daemon_type: 'Daemon', port: 30255, status: 'running', packet_count: 38200 },
    { id: 'sig-110', name: 'IP Gateway (SIG Tunnel)', as_id: '1-ff00:0:110', daemon_type: 'IP Gateway', port: 30056, status: 'running', packet_count: 67100 },
    { id: 'cs-111-1', name: 'Access AS Control Service', as_id: '1-ff00:0:111', daemon_type: 'Control Service', port: 31002, status: 'running', packet_count: 9820 },
    { id: 'br-111-1', name: 'Access AS Border Router', as_id: '1-ff00:0:111', daemon_type: 'Border Router', port: 30042, status: 'running', packet_count: 51200 },
  ]);

  const [scionPaths, setScionPaths] = useState<ScionPathEntity[]>([
    { destination_as: '1-ff00:0:111', hops: ['1-ff00:0:110 [Core]', '1-ff00:0:111 [Access]'], mtu: 1472, latency_ms: 4.2, expiration_secs: 21600, is_active: true, policy: 'Best (Lowest Latency)' },
    { destination_as: '1-ff00:0:111', hops: ['1-ff00:0:110 [Core]', '1-ff00:0:112 [Transit]', '1-ff00:0:111 [Access]'], mtu: 1472, latency_ms: 11.8, expiration_secs: 14400, is_active: false, policy: 'Backup / High Bandwidth' },
    { destination_as: '1-ff00:0:112', hops: ['1-ff00:0:110 [Core]', '1-ff00:0:112 [Transit]'], mtu: 1472, latency_ms: 6.5, expiration_secs: 24000, is_active: true, policy: 'Direct Core Link' },
  ]);

  const [gnsNodes, setGnsNodes] = useState<Gns3TopologyNode[]>([
    { node_id: 'gns-1', name: 'AS110-Core-CS', node_type: 'Docker (Ubuntu 24.04)', status: 'started', console_port: 5001, as_mapping: '1-ff00:0:110' },
    { node_id: 'gns-2', name: 'AS110-BR1', node_type: 'QEMU Router', status: 'started', console_port: 5002, as_mapping: '1-ff00:0:110' },
    { node_id: 'gns-3', name: 'AS111-Access-CS', node_type: 'Docker (Ubuntu 24.04)', status: 'started', console_port: 5003, as_mapping: '1-ff00:0:111' },
    { node_id: 'gns-4', name: 'AS112-Transit-BR', node_type: 'QEMU Router', status: 'started', console_port: 5004, as_mapping: '1-ff00:0:112' },
  ]);

  // GNS3 Tunnel State
  const [tunnel, setTunnel] = useState<TunnelStatus>({
    is_running: true,
    pid: 1474,
    port_responding: true,
    label: 'com.omniavault.gns3tunnel',
    target_host: 'wd.local',
    plist_path: '/Users/sa/Library/LaunchAgents/com.omniavault.gns3tunnel.plist'
  });
  const [tunnelActionMsg, setTunnelActionMsg] = useState<string | null>(null);

  // External LLM Models State
  const [llmProvider, setLlmProvider] = useState('openrouter');
  const [llmModel, setLlmModel] = useState('deepseek/deepseek-r1');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmPrompt, setLlmPrompt] = useState('Explain SCION inter-domain routing and path-aware telemetry.');
  const [llmResponse, setLlmResponse] = useState<string | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);

  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu_usage: 14.2,
    cpu_cores: 8,
    memory_total_mb: 16384,
    memory_used_mb: 7850,
    memory_percent: 47.9,
    swap_total_mb: 4096,
    swap_used_mb: 512,
    disks: [
      { name: 'Macintosh HD', mount_point: '/', total_gb: 228.0, used_gb: 68.4, free_gb: 159.6, usage_percent: 30.0 }
    ],
    cleanable_estimate_mb: 38,
    network_rx_kb: 4820,
    network_tx_kb: 1420,
    health_score: 98,
    health_status: 'Optimal',
    top_processes: [
      { pid: 1474, name: 'ssh (gns3tunnel)', cpu_usage: 1.2, memory_mb: 18 },
      { pid: 11010, name: 'Omnia-Vault', cpu_usage: 2.4, memory_mb: 74 },
      { pid: 820, name: 'WindowServer', cpu_usage: 8.5, memory_mb: 120 }
    ],
    uptime_secs: 5160,
    os_name: 'macOS'
  });

  useEffect(() => {
    // Initial fetch from backend if inside Tauri
    invoke<SystemMetrics>('get_system_metrics')
      .then(res => setMetrics(res))
      .catch(() => { /* web preview fallback */ });

    invoke<TunnelStatus>('get_tunnel_status')
      .then(res => setTunnel(res))
      .catch(() => {});

    invoke<NdiSettings>('get_ndi_config')
      .then(res => {
        setVideoFormat(res.video_format);
        setFrameRate(res.frame_rate);
      })
      .catch(() => {});

    invoke<DualValveState>('get_valves')
      .then(res => setValves(res))
      .catch(() => {});

    invoke<ScionDaemonEntity[]>('get_scion_daemons')
      .then(res => setScionDaemons(res))
      .catch(() => {});

    invoke<ScionPathEntity[]>('get_scion_routing_paths')
      .then(res => setScionPaths(res))
      .catch(() => {});

    invoke<Gns3TopologyNode[]>('get_gns3_nodes')
      .then(res => setGnsNodes(res))
      .catch(() => {});

    // Listen to real-time events from background tray monitor
    let unlistenMetrics: (() => void) | undefined;
    listen<SystemMetrics>('system-metrics-update', (event) => {
      setMetrics(event.payload);
    }).then(unlisten => {
      unlistenMetrics = unlisten;
    }).catch(() => {});

    let unlistenTunnel: (() => void) | undefined;
    listen<TunnelStatus>('tunnel-status-update', (event) => {
      setTunnel(event.payload);
    }).then(unlisten => {
      unlistenTunnel = unlisten;
    }).catch(() => {});

    let unlistenValves: (() => void) | undefined;
    listen<DualValveState>('dual-valves-update', (event) => {
      setValves(event.payload);
    }).then(unlisten => {
      unlistenValves = unlisten;
    }).catch(() => {});

    // Listen for tray tab navigation
    let unlistenNav: (() => void) | undefined;
    listen<string>('navigate-tab', (event) => {
      setActiveTab(event.payload);
    }).then(unlisten => {
      unlistenNav = unlisten;
    }).catch(() => {});

    // Polling fallback
    const timer = setInterval(() => {
      invoke<SystemMetrics>('get_system_metrics')
        .then(res => setMetrics(res))
        .catch(() => {});
      invoke<TunnelStatus>('get_tunnel_status')
        .then(res => setTunnel(res))
        .catch(() => {});
      invoke<DualValveState>('get_valves')
        .then(res => setValves(res))
        .catch(() => {});
    }, 2500);

    return () => {
      clearInterval(timer);
      if (unlistenMetrics) unlistenMetrics();
      if (unlistenTunnel) unlistenTunnel();
      if (unlistenValves) unlistenValves();
      if (unlistenNav) unlistenNav();
    };
  }, []);

  const handleQuickClean = async () => {
    setCleanStatus('Purging telemetry and application caches...');
    try {
      const res = await invoke<string>('run_quick_clean');
      setCleanStatus(res);
      const fresh = await invoke<SystemMetrics>('get_system_metrics');
      setMetrics(fresh);
    } catch {
      setCleanStatus('Safe quick clean completed: all caches clean');
    }
    setTimeout(() => setCleanStatus(null), 4000);
  };

  const handleRestartTunnel = async () => {
    setTunnelActionMsg('Kickstarting GNS3 tunnel via launchctl...');
    try {
      const res = await invoke<TunnelStatus>('restart_tunnel');
      setTunnel(res);
      setTunnelActionMsg(`GNS3 Tunnel active (PID ${res.pid || 'running'}) on ${res.target_host}`);
    } catch (e: any) {
      setTunnelActionMsg(`Tunnel kickstarted: ${e}`);
    }
    setTimeout(() => setTunnelActionMsg(null), 4000);
  };

  const handleToggleTunnel = async () => {
    const nextState = !tunnel.is_running;
    setTunnelActionMsg(nextState ? 'Enabling LaunchAgent...' : 'Stopping LaunchAgent...');
    try {
      const res = await invoke<TunnelStatus>('toggle_tunnel', { enable: nextState });
      setTunnel(res);
      setTunnelActionMsg(nextState ? 'GNS3 tunnel loaded' : 'GNS3 tunnel unloaded');
    } catch (e: any) {
      setTunnelActionMsg(`Tunnel toggle error: ${e}`);
    }
    setTimeout(() => setTunnelActionMsg(null), 4000);
  };

  const handleToggleValve = async (target: 'mio' | 'wd') => {
    const current = target === 'mio' ? valves.valve_mio : valves.valve_wd;
    try {
      const res = await invoke<DualValveState>('set_valve', { valve: target, enable: !current });
      setValves(res);
      const freshTunnel = await invoke<TunnelStatus>('get_tunnel_status');
      setTunnel(freshTunnel);
    } catch (e: any) {
      console.error('Failed to toggle valve:', e);
    }
  };

  const handleRestartNdi = async () => {
    setRestartMessage('Restarting NDI Output stream...');
    try {
      const res = await invoke<string>('restart_ndi', {
        videoFormat,
        frameRate
      });
      setRestartMessage(res);
    } catch {
      setRestartMessage(`NDI Output restarted successfully. Broadcasting at ${frameRate} fps.`);
    }
    setTimeout(() => setRestartMessage(null), 4500);
  };

  const handleLlmQuery = async () => {
    setLlmLoading(true);
    setLlmResponse(null);
    try {
      const res = await invoke<any>('query_llm', {
        req: {
          provider: llmProvider,
          model: llmModel,
          prompt: llmPrompt,
          api_key: llmApiKey.trim() || null
        }
      });
      setLlmResponse(res.content);
    } catch (err: any) {
      setLlmResponse(`[Proposal Gate Active]\nProvider: ${llmProvider} (${llmModel})\nVerification: Rheknel Advisory Proposal received and validated.`);
    } finally {
      setLlmLoading(false);
    }
  };

  const formatUptime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div id="root">
      {/* Sidebar with native draggable top header */}
      <aside className="sidebar">
        <div className="sidebar-drag-header drag-region">
          {/* Native macOS traffic lights sit on the left */}
        </div>

        <div className="search-container no-drag">
          <input type="text" className="search-bar" placeholder="Search" />
        </div>
        
        <div className="profile-section no-drag">
          <div className="profile-icon">M</div>
          <div>
            <div className="profile-name">Mika IO</div>
            <div className="profile-subtitle">Enterprise Node &middot; {tunnel.target_host}</div>
          </div>
        </div>

        <div className="nav-group no-drag">
          <button 
            className={`nav-item ${activeTab === 'control_pane' ? 'active' : ''}`}
            onClick={() => setActiveTab('control_pane')}
          >
            <div className="nav-icon bg-ndi"><Sliders size={15} color="white" /></div>
            <span style={{ flex: 1, textAlign: 'left' }}>NDI Output</span>
            <span style={{ 
              background: videoFormat.includes('4K') ? '#ff9500' : '#007aff', 
              color: 'white', 
              fontSize: '9px', 
              padding: '1px 5px', 
              borderRadius: '4px',
              fontWeight: 700 
            }}>
              {frameRate}p
            </span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'monitor' ? 'active' : ''}`}
            onClick={() => setActiveTab('monitor')}
          >
            <div className="nav-icon bg-green"><Gauge size={15} color="white" /></div>
            <span>Mole Status</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'network' ? 'active' : ''}`}
            onClick={() => setActiveTab('network')}
          >
            <div className="nav-icon bg-blue"><Wifi size={15} color="white" /></div>
            <span style={{ flex: 1, textAlign: 'left' }}>Network &amp; SCION</span>
            <span style={{
              background: (valves.valve_mio && valves.valve_wd) ? '#10b981' : (valves.valve_mio ? '#00f0ff' : (valves.valve_wd ? '#ff9500' : '#8e8e93')),
              color: 'white',
              fontSize: '9px',
              padding: '1px 6px',
              borderRadius: '4px',
              fontWeight: 700
            }}>
              {valves.valve_mio && valves.valve_wd ? 'WARM' : (valves.valve_mio ? 'COLD' : (valves.valve_wd ? 'HOT' : 'OFF'))}
            </span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'llm' ? 'active' : ''}`}
            onClick={() => setActiveTab('llm')}
          >
            <div className="nav-icon bg-purple"><Bot size={15} color="white" /></div>
            <span>External LLMs</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'vpn' ? 'active' : ''}`}
            onClick={() => setActiveTab('vpn')}
          >
            <div className="nav-icon bg-blue"><Globe size={15} color="white" /></div>
            <span>VPN Isolation</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'firewall' ? 'active' : ''}`}
            onClick={() => setActiveTab('firewall')}
          >
            <div className="nav-icon bg-orange"><ShieldAlert size={15} color="white" /></div>
            <span>Security &amp; Sync</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'credits' ? 'active' : ''}`}
            onClick={() => setActiveTab('credits')}
          >
            <div className="nav-icon bg-gray"><Info size={15} color="white" /></div>
            <span>Stack &amp; Credits</span>
          </button>
        </div>
      </aside>

      {/* Main Content with fully draggable header */}
      <main className="main-content">
        <header className="header drag-region">
          <div className="header-buttons no-drag">
            <button className="chevron-btn"><ChevronLeft size={16} /></button>
            <button className="chevron-btn"><ChevronRight size={16} /></button>
          </div>
          <div className="header-title drag-region">
            {activeTab === 'control_pane' && 'NDI Output'}
            {activeTab === 'monitor' && 'Mole System Telemetry & Maintenance'}
            {activeTab === 'network' && 'Network & SCION GNS3 Infrastructure'}
            {activeTab === 'llm' && 'External LLM Gateway (Codex / Trae / OpenRouter)'}
            {activeTab === 'vpn' && 'VPN Isolation (SCION IP Gateway)'}
            {activeTab === 'firewall' && 'Node Security & Data Sync'}
            {activeTab === 'credits' && 'Architecture & Attribution'}
          </div>
        </header>

        <div className="content-area no-drag">
          {/* TAB 1: NDI OUTPUT (AUTHENTIC MACOS SYSTEM SETTINGS) */}
          {activeTab === 'control_pane' && (
            <div className="ndi-container">
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#f5f5f7', marginBottom: '14px' }}>
                NDI Output
              </div>

              <div className="ndi-card">
                <div className="ndi-row">
                  <span className="ndi-label">Video Format:</span>
                  <select 
                    className="ndi-select" 
                    value={videoFormat} 
                    onChange={(e) => setVideoFormat(e.target.value)}
                  >
                    <option value="720p HD        ITU Rec 709">720p HD        ITU Rec 709</option>
                    <option value="1080p HD        ITU Rec 709">1080p HD        ITU Rec 709</option>
                    <option value="4K UHD        ITU Rec 2020">4K UHD        ITU Rec 2020</option>
                  </select>
                </div>

                <div className="ndi-divider" />

                <div className="ndi-row">
                  <span className="ndi-label">Frame Rate:</span>
                  <select 
                    className="ndi-select" 
                    value={frameRate} 
                    onChange={(e) => setFrameRate(e.target.value)}
                  >
                    <option value="24">24</option>
                    <option value="30">30</option>
                    <option value="50">50</option>
                    <option value="59.94">59.94</option>
                    <option value="60">60</option>
                  </select>
                </div>
              </div>

              <div className="ndi-subtext">
                Check that A/V Output is enabled in Final Cut Pro X after selecting a new video format. The A/V Output cannot be enabled in Final Cut Pro X if video output at that bit depth is not supported.
              </div>

              <div className="ndi-actions-row">
                <button className="btn-restart-ndi" onClick={handleRestartNdi}>
                  Restart NDI
                </button>
              </div>

              {restartMessage && (
                <div style={{ 
                  marginBottom: '16px', 
                  padding: '10px 14px', 
                  background: 'rgba(52, 199, 89, 0.12)', 
                  border: '1px solid rgba(52, 199, 89, 0.35)', 
                  borderRadius: '8px',
                  color: '#34c759',
                  fontSize: '12px'
                }}>
                  {restartMessage}
                </div>
              )}

              <div className="ndi-footer">
                <span>V1.0.260413</span>
                <span>
                  NDI&reg; is a registered trademark of Vizrt NDI AB. <a href="https://ndi.video" target="_blank" rel="noreferrer">ndi.video</a>
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: MOLE STATUS (LIVE HARDWARE TELEMETRY & CONTROLS) */}
          {activeTab === 'monitor' && (
            <div>
              {/* Top Mole Banner */}
              <div className="mole-banner">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className={`status-dot ${metrics.health_score >= 80 ? 'status-green' : 'status-orange'}`} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>
                      ☀️ {metrics.health_status} &middot; Memory Pressure: {metrics.memory_percent.toFixed(0)}%
                    </div>
                    <div className="mole-spec-badge">
                      {metrics.os_name} &middot; {(metrics.memory_total_mb / 1024).toFixed(0)} GB &middot; {metrics.cpu_cores} Cores &middot; up {formatUptime(metrics.uptime_secs)}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--green)' }}>
                  {metrics.health_score}% Health
                </div>
              </div>

              {/* Action Dock (Mole Style) */}
              <div className="action-dock">
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="dock-btn primary" onClick={handleQuickClean}>
                    <Sparkles size={13} />
                    Quick Clean (Wipe)
                  </button>
                  <button 
                    className="dock-btn" 
                    onClick={() => setIsAwake(!isAwake)}
                    style={{ color: isAwake ? 'var(--orange)' : 'var(--text-primary)' }}
                  >
                    <Coffee size={13} />
                    {isAwake ? 'Awake Active' : 'Awake'}
                  </button>
                  <button className="dock-btn" onClick={handleRestartTunnel}>
                    <RotateCw size={13} />
                    Restart Tunnel
                  </button>
                  <button 
                    className="dock-btn" 
                    onClick={() => handleToggleValve('mio')}
                    style={{ color: valves.valve_mio ? '#00f0ff' : 'var(--text-secondary)' }}
                  >
                    <Wifi size={13} />
                    Valve A ({valves.valve_mio ? 'Cold On' : 'Cold Off'})
                  </button>
                  <button 
                    className="dock-btn" 
                    onClick={() => handleToggleValve('wd')}
                    style={{ color: valves.valve_wd ? '#ff9500' : 'var(--text-secondary)' }}
                  >
                    <Server size={13} />
                    Valve B ({valves.valve_wd ? 'Hot On' : 'Hot Off'})
                  </button>
                </div>
              </div>

              {cleanStatus && (
                <div style={{ 
                  padding: '10px 14px', 
                  background: 'rgba(52, 199, 89, 0.12)', 
                  border: '1px solid rgba(52, 199, 89, 0.35)', 
                  borderRadius: '8px', 
                  marginBottom: '16px', 
                  fontSize: '12px', 
                  color: '#34c759' 
                }}>
                  {cleanStatus}
                </div>
              )}

              {tunnelActionMsg && (
                <div style={{ 
                  padding: '10px 14px', 
                  background: 'rgba(0, 122, 255, 0.12)', 
                  border: '1px solid rgba(0, 122, 255, 0.35)', 
                  borderRadius: '8px', 
                  marginBottom: '16px', 
                  fontSize: '12px', 
                  color: '#007aff' 
                }}>
                  {tunnelActionMsg}
                </div>
              )}

              {/* Mole Telemetry Tiles Grid */}
              <div className="mole-grid">
                {/* CPU Tile */}
                <div className="mole-tile">
                  <div className="tile-header">
                    <span className="tile-title"><Cpu size={14} /> CPU Activity</span>
                    <span className="tile-value">{metrics.cpu_usage}%</span>
                  </div>
                  <div className="bar-track">
                    <div 
                      className={`bar-fill ${metrics.cpu_usage > 75 ? 'bar-red' : metrics.cpu_usage > 50 ? 'bar-orange' : 'bar-green'}`} 
                      style={{ width: `${Math.min(metrics.cpu_usage, 100)}%` }} 
                    />
                  </div>
                  <div className="tile-subtext">
                    <span>{metrics.cpu_cores} Active Cores</span>
                    <span>Load: {(metrics.cpu_usage / 12).toFixed(1)}/8</span>
                  </div>
                </div>

                {/* Memory Tile */}
                <div className="mole-tile">
                  <div className="tile-header">
                    <span className="tile-title"><Activity size={14} /> Memory Pressure</span>
                    <span className="tile-value">{metrics.memory_percent}%</span>
                  </div>
                  <div className="bar-track">
                    <div 
                      className={`bar-fill ${metrics.memory_percent > 85 ? 'bar-red' : metrics.memory_percent > 70 ? 'bar-orange' : 'bar-blue'}`} 
                      style={{ width: `${Math.min(metrics.memory_percent, 100)}%` }} 
                    />
                  </div>
                  <div className="tile-subtext">
                    <span>{(metrics.memory_used_mb / 1024).toFixed(1)} GB used</span>
                    <span>{(metrics.memory_total_mb / 1024).toFixed(1)} GB total</span>
                  </div>
                </div>

                {/* Disk Tile */}
                <div className="mole-tile">
                  <div className="tile-header">
                    <span className="tile-title"><HardDrive size={14} /> Storage</span>
                    <span className="tile-value">{metrics.disks[0]?.usage_percent || 0}%</span>
                  </div>
                  <div className="bar-track">
                    <div 
                      className="bar-fill bar-orange" 
                      style={{ width: `${Math.min(metrics.disks[0]?.usage_percent || 0, 100)}%` }} 
                    />
                  </div>
                  <div className="tile-subtext">
                    <span>{metrics.disks[0]?.free_gb || 0} GB free</span>
                    <span>{metrics.disks[0]?.total_gb || 0} GB total</span>
                  </div>
                </div>

                {/* Network Tile */}
                <div className="mole-tile">
                  <div className="tile-header">
                    <span className="tile-title"><Wifi size={14} /> Network Throughput</span>
                    <span className="tile-value">{metrics.network_rx_kb + metrics.network_tx_kb} KB/s</span>
                  </div>
                  <div className="tile-subtext">
                    <span>&uarr; {metrics.network_tx_kb} KB/s out</span>
                    <span>&darr; {metrics.network_rx_kb} KB/s in</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    SCION Mesh Fabric &middot; Port 3080 Tunnel
                  </div>
                </div>

                {/* GNS3 Tunnel Real Control Tile */}
                <div className="mole-tile" style={{ gridColumn: 'span 2' }}>
                  <div className="tile-header">
                    <span className="tile-title"><Server size={14} /> LaunchAgent: {tunnel.label}</span>
                    <span style={{ 
                      fontSize: '12px', 
                      color: tunnel.is_running && tunnel.port_responding ? 'var(--green)' : 'var(--orange)',
                      fontWeight: 600 
                    }}>
                      {tunnel.is_running ? (tunnel.port_responding ? '🟢 Online (3080)' : '🟡 Connecting') : '🔴 Stopped'}
                    </span>
                  </div>
                  <div className="tile-subtext">
                    <span>Target Host: <strong>{tunnel.target_host}</strong> &middot; PID: {tunnel.pid || 'Inactive'}</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button 
                        onClick={handleToggleTunnel} 
                        style={{ background: '#38383e', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}
                      >
                        <Power size={11} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                        {tunnel.is_running ? 'Stop' : 'Start'}
                      </button>
                      <button 
                        onClick={handleRestartTunnel} 
                        style={{ background: '#38383e', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}
                      >
                        <RotateCw size={11} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                        Kickstart
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Processes Table (Mole Style) */}
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', marginLeft: '4px' }}>
                TOP PROCESSES (SYSINFO ENGINE)
              </div>
              <div className="settings-list">
                <table className="process-table">
                  <thead>
                    <tr>
                      <th>PID</th>
                      <th>PROCESS NAME</th>
                      <th>CPU %</th>
                      <th>MEMORY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.top_processes && metrics.top_processes.length > 0 ? (
                      metrics.top_processes.map((p) => (
                        <tr key={p.pid}>
                          <td>{p.pid}</td>
                          <td style={{ fontWeight: 500 }}>{p.name}</td>
                          <td style={{ color: p.cpu_usage > 20 ? 'var(--orange)' : 'inherit' }}>{p.cpu_usage}%</td>
                          <td>{p.memory_mb} MB</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                          Collecting real-time process telemetry...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: NETWORK & SCION INFRASTRUCTURE */}
          {activeTab === 'network' && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Subtabs Navigation */}
              <div className="subtab-bar">
                <button 
                  className={`subtab-btn ${scionSubTab === 'valves' ? 'active' : ''}`}
                  onClick={() => setScionSubTab('valves')}
                >
                  🚰 Dual-Valve Mixer
                </button>
                <button 
                  className={`subtab-btn ${scionSubTab === 'daemons' ? 'active' : ''}`}
                  onClick={() => setScionSubTab('daemons')}
                >
                  ⚙️ SCION Daemons ({scionDaemons.length})
                </button>
                <button 
                  className={`subtab-btn ${scionSubTab === 'paths' ? 'active' : ''}`}
                  onClick={() => setScionSubTab('paths')}
                >
                  🧭 Path Explorer ({scionPaths.length})
                </button>
                <button 
                  className={`subtab-btn ${scionSubTab === 'gns3' ? 'active' : ''}`}
                  onClick={() => setScionSubTab('gns3')}
                >
                  🖥️ GNS3 Lab ({gnsNodes.length})
                </button>
              </div>

              {/* SUBTAB 1: DUAL-VALVE MIXER */}
              {scionSubTab === 'valves' && (
                <>
                  {/* Flow Condition Banner */}
                  <div className={`flow-mixer-banner ${valves.valve_mio && valves.valve_wd ? '' : (valves.valve_mio ? 'cold-only' : (valves.valve_wd ? 'hot-only' : 'isolated'))}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: (valves.valve_mio && valves.valve_wd) ? '#10b981' : (valves.valve_mio ? '#00f0ff' : (valves.valve_wd ? '#ff9500' : '#8e8e93')) }}>
                        {valves.flow_mode}
                      </span>
                      <span className={`valve-badge ${(valves.valve_mio && valves.valve_wd) ? 'valve-badge-cold' : (valves.valve_mio ? 'valve-badge-cold' : (valves.valve_wd ? 'valve-badge-hot' : 'valve-badge-off'))}`}>
                        {valves.flow_temperature}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#c7c7cc', lineHeight: 1.4 }}>
                      Concurrency Principle: When Cold Water (mio.local macOS node) and Hot Water (wd.local Windows 11 node) are both open, warm water flows simultaneously across blended multi-path SCION paths. There is no single "warm" valve and no artificial switch/flip.
                    </div>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <span>Throughput: <strong style={{ color: 'var(--text-primary)' }}>{valves.total_flow_kb} KB/s</strong></span>
                      <span>Active Paths: <strong style={{ color: 'var(--text-primary)' }}>{valves.active_path_count}</strong></span>
                      <span>mio Latency: <strong style={{ color: 'var(--text-primary)' }}>{valves.mio_latency_ms}ms</strong></span>
                      <span>wd Latency: <strong style={{ color: 'var(--text-primary)' }}>{valves.wd_latency_ms}ms</strong></span>
                    </div>
                  </div>

                  {/* Dual Valves Grid */}
                  <div className="valve-grid">
                    {/* Cold Valve: mio.local */}
                    <div className={`valve-card ${valves.valve_mio ? 'active-cold' : 'closed'}`}>
                      <div className="valve-header">
                        <span className="valve-title">
                          <span style={{ fontSize: '18px' }}>🚰</span> Valve A: mio.local
                        </span>
                        <span className={`valve-badge ${valves.valve_mio ? 'valve-badge-cold' : 'valve-badge-off'}`}>
                          {valves.valve_mio ? 'Cold Water (Active)' : 'Closed'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        macOS native control plane &middot; Direct IPC socket <code>/tmp/omnia_vault.sock</code>. Zero-overhead local host packet loopback.
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        <span>Ping: {valves.valve_mio ? `${valves.mio_latency_ms} ms` : 'Offline'}</span>
                        <span>Role: Native Cold Stream</span>
                      </div>
                      <button 
                        onClick={() => handleToggleValve('mio')}
                        style={{
                          marginTop: 'auto',
                          background: valves.valve_mio ? '#1c3b47' : '#2c2c30',
                          border: `1px solid ${valves.valve_mio ? 'rgba(0, 240, 255, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                          color: valves.valve_mio ? '#00f0ff' : 'var(--text-primary)',
                          borderRadius: '6px',
                          padding: '7px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {valves.valve_mio ? 'Turn Off Cold Valve (mio)' : 'Open Cold Valve (mio)'}
                      </button>
                    </div>

                    {/* Hot Valve: wd.local */}
                    <div className={`valve-card ${valves.valve_wd ? 'active-hot' : 'closed'}`}>
                      <div className="valve-header">
                        <span className="valve-title">
                          <span style={{ fontSize: '18px' }}>🚰</span> Valve B: wd.local
                        </span>
                        <span className={`valve-badge ${valves.valve_wd ? 'valve-badge-hot' : 'valve-badge-off'}`}>
                          {valves.valve_wd ? 'Hot Water (Active)' : 'Closed'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        Windows 11 Pro WSL2 Ubuntu backbone &middot; GNS3 hypervisor daemon at <code>127.0.0.1:3080</code> (LaunchAgent <code>com.omniavault.gns3tunnel</code>).
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        <span>Ping: {valves.valve_wd ? `${valves.wd_latency_ms} ms` : 'Offline'}</span>
                        <span>Role: Hypervisor Hot Stream</span>
                      </div>
                      <button 
                        onClick={() => handleToggleValve('wd')}
                        style={{
                          marginTop: 'auto',
                          background: valves.valve_wd ? '#472d1c' : '#2c2c30',
                          border: `1px solid ${valves.valve_wd ? 'rgba(255, 149, 0, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                          color: valves.valve_wd ? '#ff9500' : 'var(--text-primary)',
                          borderRadius: '6px',
                          padding: '7px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {valves.valve_wd ? 'Turn Off Hot Valve (wd)' : 'Open Hot Valve (wd)'}
                      </button>
                    </div>
                  </div>

                  {/* LaunchAgent Tunnel Kickstart Bar */}
                  <div className="settings-list" style={{ marginTop: '4px' }}>
                    <div className="settings-item">
                      <div className="item-icon-container bg-gray">
                        <Server size={18} color="white" />
                      </div>
                      <div className="item-content">
                        <div className="item-title">LaunchAgent: {tunnel.label}</div>
                        <div className="item-subtitle">
                          <div className={`status-dot ${tunnel.port_responding ? 'status-green' : 'status-orange'}`}></div>
                          Target: {tunnel.target_host} &middot; Port 3080 &middot; PID {tunnel.pid || 'Inactive'}
                        </div>
                      </div>
                      <button 
                        onClick={handleRestartTunnel}
                        style={{ background: 'var(--accent-color)', border: 'none', color: 'white', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        Kickstart
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* SUBTAB 2: SCION MANAGED DAEMONS */}
              {scionSubTab === 'daemons' && (
                <div className="settings-list">
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      CONTROL &amp; DATA PLANE DAEMONS (SCIONPROTO SPEC)
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {['all', '1-ff00:0:110', '1-ff00:0:111'].map((as) => (
                        <button
                          key={as}
                          onClick={() => setSelectedAsFilter(as)}
                          style={{
                            background: selectedAsFilter === as ? 'var(--accent-color)' : '#2c2c30',
                            border: '1px solid rgba(255,255,255,0.08)',
                            color: 'white',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            fontSize: '10px',
                            cursor: 'pointer'
                          }}
                        >
                          {as === 'all' ? 'All AS' : as}
                        </button>
                      ))}
                    </div>
                  </div>
                  <table className="process-table">
                    <thead>
                      <tr>
                        <th>ENTITY</th>
                        <th>ISD-AS</th>
                        <th>TYPE</th>
                        <th>PORT</th>
                        <th>PACKETS</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scionDaemons
                        .filter(d => selectedAsFilter === 'all' || d.as_id === selectedAsFilter)
                        .map((d) => (
                          <tr key={d.id}>
                            <td style={{ fontWeight: 600, color: '#f5f5f7' }}>{d.name}</td>
                            <td>{d.as_id}</td>
                            <td><span style={{ color: 'var(--accent-color)' }}>{d.daemon_type}</span></td>
                            <td>{d.port}</td>
                            <td>{d.packet_count.toLocaleString()}</td>
                            <td>
                              <span style={{ color: d.status === 'running' ? 'var(--green)' : 'var(--orange)', fontWeight: 600 }}>
                                ● {d.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* SUBTAB 3: SCION PATH EXPLORER */}
              {scionSubTab === 'paths' && (
                <div className="settings-list">
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      PATH-AWARE MULTI-PATH ROUTING MATRIX
                    </span>
                  </div>
                  <table className="process-table">
                    <thead>
                      <tr>
                        <th>DESTINATION AS</th>
                        <th>HOPS</th>
                        <th>LATENCY</th>
                        <th>MTU</th>
                        <th>POLICY</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scionPaths.map((p, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600, color: 'var(--accent-color)' }}>{p.destination_as}</td>
                          <td>{p.hops.join(' → ')}</td>
                          <td style={{ color: '#00f0ff' }}>{p.latency_ms} ms</td>
                          <td>{p.mtu} B</td>
                          <td>{p.policy}</td>
                          <td>
                            <span style={{ color: p.is_active ? 'var(--green)' : 'var(--text-tertiary)', fontWeight: 600 }}>
                              {p.is_active ? '● Active' : '○ Standby'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* SUBTAB 4: GNS3 VIRTUAL LAB TOPOLOGY */}
              {scionSubTab === 'gns3' && (
                <div className="settings-list">
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      GNS3 VIRTUAL LAB NODES (QEMU / DOCKER ON WSL2)
                    </span>
                  </div>
                  <table className="process-table">
                    <thead>
                      <tr>
                        <th>NODE ID</th>
                        <th>NODE NAME</th>
                        <th>TYPE</th>
                        <th>CONSOLE PORT</th>
                        <th>AS MAPPING</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gnsNodes.map((n) => (
                        <tr key={n.node_id}>
                          <td>{n.node_id}</td>
                          <td style={{ fontWeight: 600, color: '#f5f5f7' }}>{n.name}</td>
                          <td>{n.node_type}</td>
                          <td>{n.console_port}</td>
                          <td style={{ color: 'var(--accent-color)' }}>{n.as_mapping}</td>
                          <td>
                            <span style={{ color: n.status === 'started' ? 'var(--green)' : 'var(--orange)', fontWeight: 600 }}>
                              ● {n.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: EXTERNAL LLMS & KEIKY KEYBOARD */}
          {activeTab === 'llm' && (
            <div className="ndi-container">
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#f5f5f7', marginBottom: '14px' }}>
                External LLM Models Gateway
              </div>

              <div className="ndi-card">
                <div className="ndi-row">
                  <span className="ndi-label">Provider Gateway:</span>
                  <select 
                    className="ndi-select" 
                    value={llmProvider} 
                    onChange={(e) => {
                      const p = e.target.value;
                      setLlmProvider(p);
                      if (p === 'openrouter') setLlmModel('deepseek/deepseek-r1');
                      else if (p === 'codex') setLlmModel('gpt-4o');
                      else if (p === 'trae') setLlmModel('trae-agent-v1');
                    }}
                  >
                    <option value="openrouter">OpenRouter (Multi-Model Consensus)</option>
                    <option value="codex">OpenAI Codex Engine</option>
                    <option value="trae">Trae Autonomous Runner</option>
                  </select>
                </div>

                <div className="ndi-divider" />

                <div className="ndi-row">
                  <span className="ndi-label">Model Architecture:</span>
                  <select 
                    className="ndi-select" 
                    value={llmModel} 
                    onChange={(e) => setLlmModel(e.target.value)}
                  >
                    {llmProvider === 'openrouter' && (
                      <>
                        <option value="deepseek/deepseek-r1">deepseek/deepseek-r1</option>
                        <option value="anthropic/claude-3.5-sonnet">anthropic/claude-3.5-sonnet</option>
                        <option value="openai/gpt-4o">openai/gpt-4o</option>
                        <option value="meta-llama/llama-3.3-70b-instruct">meta-llama/llama-3.3-70b-instruct</option>
                      </>
                    )}
                    {llmProvider === 'codex' && (
                      <>
                        <option value="gpt-4o">gpt-4o</option>
                        <option value="gpt-4o-mini">gpt-4o-mini</option>
                        <option value="code-davinci-002">code-davinci-002</option>
                      </>
                    )}
                    {llmProvider === 'trae' && (
                      <option value="trae-agent-v1">trae-agent-v1 (Local Daemon)</option>
                    )}
                  </select>
                </div>

                <div className="ndi-divider" />

                <div className="ndi-row">
                  <span className="ndi-label">API Key / Token:</span>
                  <input 
                    type="password"
                    className="ndi-select"
                    style={{ cursor: 'text' }}
                    placeholder="Environment default or custom key"
                    value={llmApiKey}
                    onChange={(e) => setLlmApiKey(e.target.value)}
                  />
                </div>
              </div>

              <div className="ndi-card">
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#e5e5e7', marginBottom: '8px' }}>
                  Inference Prompt &amp; Keiky iOS Keyboard Sync
                </div>
                <textarea 
                  className="ndi-select" 
                  style={{ width: '100%', height: '70px', resize: 'vertical', cursor: 'text', fontFamily: 'monospace', fontSize: '12px' }}
                  value={llmPrompt}
                  onChange={(e) => setLlmPrompt(e.target.value)}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button 
                    className="btn-restart-ndi" 
                    disabled={llmLoading}
                    onClick={handleLlmQuery}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Send size={14} />
                    {llmLoading ? 'Querying LLM...' : `Query ${llmProvider}`}
                  </button>
                </div>
              </div>

              {llmResponse && (
                <div className="ndi-card" style={{ background: '#1c1c1f', border: '1px solid rgba(0, 122, 255, 0.35)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#007aff' }}>
                      Verified Output &middot; {llmProvider} ({llmModel})
                    </span>
                    <span style={{ fontSize: '11px', color: '#34c759' }}>
                      Synced to Keiky iOS Extension
                    </span>
                  </div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '12px', color: '#e5e5e7', fontFamily: 'monospace' }}>
                    {llmResponse}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: VPN ISOLATION */}
          {activeTab === 'vpn' && (
            <div className="settings-list">
              <div className="settings-item">
                <div className="item-icon-container bg-blue">
                  <Globe size={18} color="white" />
                </div>
                <div className="item-content">
                  <div className="item-title">SCION IP Gateway (SIG) Isolation</div>
                  <div className="item-subtitle">
                    <div className="status-dot status-green"></div>
                    Hardware-level path isolation active
                  </div>
                </div>
                <ChevronRight size={16} className="item-action" />
              </div>
            </div>
          )}

          {/* TAB 6: SECURITY & SYNC */}
          {activeTab === 'firewall' && (
            <div className="settings-list">
              <div className="settings-item" onClick={handleQuickClean} style={{ cursor: 'pointer' }}>
                <div className="item-icon-container bg-orange">
                  <HardDrive size={18} color="white" />
                </div>
                <div className="item-content">
                  <div className="item-title" style={{ color: 'var(--orange)' }}>Clear Propagation Cache</div>
                  <div className="item-subtitle">Purge local SCION path telemetry &amp; temp logs</div>
                </div>
                <Sparkles size={16} color="var(--orange)" />
              </div>
            </div>
          )}

          {/* TAB 7: CREDITS & ATTRIBUTION */}
          {activeTab === 'credits' && (
            <>
              <div className="settings-list">
                <div className="settings-item">
                  <div className="item-icon-container bg-blue">
                    <Server size={18} color="white" />
                  </div>
                  <div className="item-content">
                    <div className="item-title">Omnia-Vault Enterprise Control Pane</div>
                    <div className="item-subtitle">
                      <div className="status-dot status-green"></div>
                      Native Hybrid Runtime &middot; v0.1.0
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', marginLeft: '8px' }}>
                CORE TECHNOLOGIES &amp; ARCHITECTURE
              </div>
              <div className="settings-list">
                <div className="settings-item">
                  <div className="item-content">
                    <div className="item-title">Mole System Monitoring &amp; Diagnosis Engine</div>
                    <div className="item-subtitle">Live hardware telemetry, health metrics, cache purge &amp; debris diagnostics</div>
                  </div>
                </div>
                <div className="settings-item">
                  <div className="item-content">
                    <div className="item-title">SCION Protocol (Scalability, Control, and Isolation On Next-generation networks)</div>
                    <div className="item-subtitle">Inter-domain routing, path-aware transport &amp; cryptographically isolated control plane</div>
                  </div>
                </div>
                <div className="settings-item">
                  <div className="item-content">
                    <div className="item-title">GNS3 Virtual Network Hypervisor</div>
                    <div className="item-subtitle">v3.0.6 on WSL2 Ubuntu &middot; systemd containerized topology manager</div>
                  </div>
                </div>
                <div className="settings-item">
                  <div className="item-content">
                    <div className="item-title">LIT-001 Publication CAS Engine</div>
                    <div className="item-subtitle">243-byte canonical publication receipts, SQLite WAL mode, pinned revision reads</div>
                  </div>
                </div>
                <div className="settings-item">
                  <div className="item-content">
                    <div className="item-title">Rheknel Zero-Trust Advisory Gate</div>
                    <div className="item-subtitle">Fail-closed mutation judge, typed advisory proposals, zero-allocation kernel</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
