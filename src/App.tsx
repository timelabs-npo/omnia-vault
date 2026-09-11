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
  Bot,
  Send,
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

export default function App() {
  const [activeTab, setActiveTab] = useState('network');
  const [cleanStatus, setCleanStatus] = useState<string | null>(null);

  // Status message states
  const [tunnelActionMsg, setTunnelActionMsg] = useState<string | null>(null);

  // Dual Valve / Proxy State
  const [valves, setValves] = useState<DualValveState>({
    valve_mio: false,
    valve_wd: false,
    flow_mode: 'Unavailable',
    flow_temperature: 'Unavailable',
    total_flow_kb: 0,
    active_path_count: 0,
    mio_latency_ms: 0,
    wd_latency_ms: 0
  });

  // SCION Subtabs & Entities
  const [scionSubTab, setScionSubTab] = useState<'valves' | 'daemons' | 'paths' | 'gns3'>('valves');
  const [selectedAsFilter, setSelectedAsFilter] = useState('all');

  const [scionDaemons, setScionDaemons] = useState<ScionDaemonEntity[]>([]);
  const [scionPaths, setScionPaths] = useState<ScionPathEntity[]>([]);
  const [gnsNodes, setGnsNodes] = useState<Gns3TopologyNode[]>([]);

  // Tunnel State
  const [tunnel, setTunnel] = useState<TunnelStatus>({
    is_running: false,
    pid: null,
    port_responding: false,
    label: 'Unknown',
    target_host: 'Unknown',
    plist_path: ''
  });

  // External LLM Models State
  const [llmProvider, setLlmProvider] = useState('openrouter');
  const [llmModel, setLlmModel] = useState('deepseek/deepseek-r1');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmPrompt, setLlmPrompt] = useState('');
  const [llmResponse, setLlmResponse] = useState<string | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);

  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);

  useEffect(() => {
    // Initial fetch from backend
    invoke<SystemMetrics>('get_system_metrics').then(setMetrics).catch(() => {});
    invoke<TunnelStatus>('get_tunnel_status').then(setTunnel).catch(() => {});
    invoke<DualValveState>('get_valves').then(setValves).catch(() => {});
    invoke<ScionDaemonEntity[]>('get_scion_daemons').then(setScionDaemons).catch(() => {});
    invoke<ScionPathEntity[]>('get_scion_routing_paths').then(setScionPaths).catch(() => {});
    invoke<Gns3TopologyNode[]>('get_gns3_nodes').then(setGnsNodes).catch(() => {});

    // Listen to real-time events from background tray monitor
    const unlisteners: (() => void)[] = [];
    
    listen<SystemMetrics>('system-metrics-update', (event) => setMetrics(event.payload)).then(u => unlisteners.push(u));
    listen<TunnelStatus>('tunnel-status-update', (event) => setTunnel(event.payload)).then(u => unlisteners.push(u));
    listen<DualValveState>('dual-valves-update', (event) => setValves(event.payload)).then(u => unlisteners.push(u));
    listen<string>('navigate-tab', (event) => setActiveTab(event.payload)).then(u => unlisteners.push(u));

    // Polling fallback
    const timer = setInterval(() => {
      invoke<SystemMetrics>('get_system_metrics').then(setMetrics).catch(() => {});
      invoke<TunnelStatus>('get_tunnel_status').then(setTunnel).catch(() => {});
      invoke<DualValveState>('get_valves').then(setValves).catch(() => {});
    }, 2500);

    return () => {
      clearInterval(timer);
      unlisteners.forEach(u => u());
    };
  }, []);

  const handleQuickClean = async () => {
    setCleanStatus('Clearing caches...');
    try {
      const res = await invoke<string>('run_quick_clean');
      setCleanStatus(res);
      const fresh = await invoke<SystemMetrics>('get_system_metrics');
      setMetrics(fresh);
    } catch (e: any) {
      setCleanStatus(`Failed to clean: ${e}`);
    }
    setTimeout(() => setCleanStatus(null), 4000);
  };

  const handleToggleTunnel = async () => {
    const nextState = !tunnel.is_running;
    setTunnelActionMsg(nextState ? 'Starting WSL Tunnel...' : 'Stopping WSL Tunnel...');
    try {
      const res = await invoke<TunnelStatus>('toggle_tunnel', { enable: nextState });
      setTunnel(res);
      setTunnelActionMsg(nextState ? 'WSL tunnel started' : 'WSL tunnel stopped');
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
      console.error('Failed to toggle proxy routing:', e);
    }
  };

  const handleLlmQuery = async () => {
    if (!llmApiKey.trim()) {
      setLlmResponse('Error: API key required.');
      return;
    }
    
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
      // The Rust backend returns a struct, the text is typically in a `response` field, or we just stringify.
      if (typeof res === 'string') {
          setLlmResponse(res);
      } else if (res && res.response) {
          setLlmResponse(res.response);
      } else if (res && res.content) {
          setLlmResponse(res.content);
      } else {
          setLlmResponse(JSON.stringify(res, null, 2));
      }
    } catch (err: any) {
      setLlmResponse(`Error: ${err}`);
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
    <div className="app-container">
      {/* Sidebar with native draggable top header */}
      <aside className="sidebar">
        <div className="sidebar-drag-header drag-region">
          {/* Native macOS traffic lights sit on the left */}
        </div>

        <div className="search-container no-drag">
          <input type="text" className="search-bar" placeholder="Search" />
        </div>

        <div className="nav-group no-drag" style={{ marginTop: '16px' }}>
          
          <button 
            className={`nav-item ${activeTab === 'network' ? 'active' : ''}`}
            onClick={() => setActiveTab('network')}
          >
            <div className="nav-icon bg-blue"><Wifi size={15} color="white" /></div>
            <span style={{ flex: 1, textAlign: 'left' }}>Connections</span>
            <span style={{
              background: (valves.valve_mio && valves.valve_wd) ? '#10b981' : (valves.valve_mio || valves.valve_wd ? '#007aff' : '#8e8e93'),
              color: 'white',
              fontSize: '9px',
              padding: '1px 6px',
              borderRadius: '4px',
              fontWeight: 700
            }}>
              {valves.valve_mio && valves.valve_wd ? 'ACTIVE' : (valves.valve_mio || valves.valve_wd ? 'DEGRADED' : 'OFF')}
            </span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'system' ? 'active' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            <div className="nav-icon bg-green"><Activity size={15} color="white" /></div>
            <span>System</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'llm' ? 'active' : ''}`}
            onClick={() => setActiveTab('llm')}
          >
            <div className="nav-icon bg-purple"><Bot size={15} color="white" /></div>
            <span>AI Models</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'firewall' ? 'active' : ''}`}
            onClick={() => setActiveTab('firewall')}
          >
            <div className="nav-icon bg-orange"><ShieldAlert size={15} color="white" /></div>
            <span>Security</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            <div className="nav-icon bg-gray"><Info size={15} color="white" /></div>
            <span>About</span>
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
            {activeTab === 'system' && 'System Telemetry'}
            {activeTab === 'network' && 'Network Connections & Routing'}
            {activeTab === 'llm' && 'AI Model Gateway'}
            {activeTab === 'firewall' && 'Security Policies'}
            {activeTab === 'about' && 'About Omnia-Vault'}
          </div>
        </header>

        <div className="content-area no-drag">
          
          {/* TAB 1: SYSTEM */}
          {activeTab === 'system' && metrics && (
            <div>
              <div className="mole-banner">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className={`status-dot status-green`} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>
                      {metrics.os_name} &middot; Memory Used: {metrics.memory_percent.toFixed(0)}%
                    </div>
                    <div className="mole-spec-badge">
                      {(metrics.memory_total_mb / 1024).toFixed(0)} GB &middot; {metrics.cpu_cores} Cores &middot; up {formatUptime(metrics.uptime_secs)}
                    </div>
                  </div>
                </div>
              </div>

              {/* System Grid */}
              <div className="mole-grid">
                {/* CPU Tile */}
                <div className="mole-tile">
                  <div className="tile-header">
                    <span className="tile-title"><Cpu size={14} /> CPU Usage</span>
                    <span className="tile-value">{metrics.cpu_usage.toFixed(1)}%</span>
                  </div>
                  <div className="bar-track">
                    <div 
                      className={`bar-fill ${metrics.cpu_usage > 75 ? 'bar-red' : metrics.cpu_usage > 50 ? 'bar-orange' : 'bar-green'}`} 
                      style={{ width: `${Math.min(metrics.cpu_usage, 100)}%` }} 
                    />
                  </div>
                </div>

                {/* Memory Tile */}
                <div className="mole-tile">
                  <div className="tile-header">
                    <span className="tile-title"><Activity size={14} /> Memory</span>
                    <span className="tile-value">{metrics.memory_percent.toFixed(1)}%</span>
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
                    <span className="tile-title"><HardDrive size={14} /> Disk Storage</span>
                    <span className="tile-value">{metrics.disks[0]?.usage_percent.toFixed(1) || 0}%</span>
                  </div>
                  <div className="bar-track">
                    <div 
                      className="bar-fill bar-orange" 
                      style={{ width: `${Math.min(metrics.disks[0]?.usage_percent || 0, 100)}%` }} 
                    />
                  </div>
                  <div className="tile-subtext">
                    <span>{metrics.disks[0]?.free_gb.toFixed(1) || 0} GB free</span>
                    <span>{metrics.disks[0]?.total_gb.toFixed(1) || 0} GB total</span>
                  </div>
                </div>

                {/* Network Tile */}
                <div className="mole-tile">
                  <div className="tile-header">
                    <span className="tile-title"><Wifi size={14} /> Local Throughput</span>
                    <span className="tile-value">{(metrics.network_rx_kb + metrics.network_tx_kb).toFixed(1)} KB/s</span>
                  </div>
                  <div className="tile-subtext">
                    <span>&uarr; {metrics.network_tx_kb.toFixed(1)} KB/s out</span>
                    <span>&darr; {metrics.network_rx_kb.toFixed(1)} KB/s in</span>
                  </div>
                </div>
              </div>

              {/* Processes Table */}
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', marginLeft: '4px', marginTop: '16px' }}>
                TOP PROCESSES
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
                          <td style={{ color: p.cpu_usage > 20 ? 'var(--orange)' : 'inherit' }}>{p.cpu_usage.toFixed(1)}%</td>
                          <td>{p.memory_mb.toFixed(0)} MB</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                          No processes found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === 'system' && !metrics && (
             <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>Loading System Metrics...</div>
          )}

          {/* TAB 2: NETWORK & CONNECTIONS */}
          {activeTab === 'network' && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="subtab-bar">
                <button 
                  className={`subtab-btn ${scionSubTab === 'valves' ? 'active' : ''}`}
                  onClick={() => setScionSubTab('valves')}
                >
                  Proxy Routing
                </button>
                <button 
                  className={`subtab-btn ${scionSubTab === 'daemons' ? 'active' : ''}`}
                  onClick={() => setScionSubTab('daemons')}
                >
                  SCION Daemons ({scionDaemons.length})
                </button>
                <button 
                  className={`subtab-btn ${scionSubTab === 'paths' ? 'active' : ''}`}
                  onClick={() => setScionSubTab('paths')}
                >
                  SCION Paths ({scionPaths.length})
                </button>
                <button 
                  className={`subtab-btn ${scionSubTab === 'gns3' ? 'active' : ''}`}
                  onClick={() => setScionSubTab('gns3')}
                >
                  WSL Virtual Nodes ({gnsNodes.length})
                </button>
              </div>

              {scionSubTab === 'valves' && (
                <>
                  <div className="valve-grid" style={{ marginTop: '16px' }}>
                    {/* Mio Proxy (macOS PAC) */}
                    <div className={`valve-card ${valves.valve_mio ? 'active-cold' : 'closed'}`}>
                      <div className="valve-header">
                        <span className="valve-title">
                          <span style={{ fontSize: '18px' }}>🌐</span> Mio Proxy (macOS)
                        </span>
                        <span className={`valve-badge ${valves.valve_mio ? 'valve-badge-cold' : 'valve-badge-off'}`}>
                          {valves.valve_mio ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        Routes macOS native browser traffic through SCION PAC configuration. Local socket.
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        <span>Ping: {valves.valve_mio ? `${valves.mio_latency_ms} ms` : 'Offline'}</span>
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
                        {valves.valve_mio ? 'Disable Mio Proxy' : 'Enable Mio Proxy'}
                      </button>
                    </div>

                    {/* WD Proxy (Windows WSL) */}
                    <div className={`valve-card ${valves.valve_wd ? 'active-hot' : 'closed'}`}>
                      <div className="valve-header">
                        <span className="valve-title">
                          <span style={{ fontSize: '18px' }}>🌐</span> WD Proxy (WSL)
                        </span>
                        <span className={`valve-badge ${valves.valve_wd ? 'valve-badge-hot' : 'valve-badge-off'}`}>
                          {valves.valve_wd ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        Routes traffic through Windows 11 WSL2 SCION network backbone.
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        <span>Ping: {valves.valve_wd ? `${valves.wd_latency_ms} ms` : 'Offline'}</span>
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
                        {valves.valve_wd ? 'Disable WD Proxy' : 'Enable WD Proxy'}
                      </button>
                    </div>
                  </div>

                  <div className="settings-list" style={{ marginTop: '16px' }}>
                    <div className="settings-item">
                      <div className="item-icon-container bg-gray">
                        <Server size={18} color="white" />
                      </div>
                      <div className="item-content">
                        <div className="item-title">WSL Tunnel Process: {tunnel.label}</div>
                        <div className="item-subtitle">
                          <div className={`status-dot ${tunnel.port_responding ? 'status-green' : 'status-orange'}`}></div>
                          Target: {tunnel.target_host} &middot; PID {tunnel.pid || 'Inactive'}
                        </div>
                      </div>
                      <button 
                        onClick={handleToggleTunnel}
                        style={{ background: '#38383e', border: 'none', color: 'white', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer', marginRight: '8px' }}
                      >
                        {tunnel.is_running ? 'Stop' : 'Start'}
                      </button>
                    </div>
                  </div>
                  {tunnelActionMsg && (
                    <div style={{ 
                      padding: '10px 14px', 
                      background: 'rgba(0, 122, 255, 0.12)', 
                      border: '1px solid rgba(0, 122, 255, 0.35)', 
                      borderRadius: '8px', 
                      marginTop: '16px', 
                      fontSize: '12px', 
                      color: '#007aff' 
                    }}>
                      {tunnelActionMsg}
                    </div>
                  )}
                </>
              )}

              {scionSubTab === 'daemons' && (
                <div className="settings-list">
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
                      {scionDaemons.length > 0 ? scionDaemons.map((d) => (
                          <tr key={d.id}>
                            <td style={{ fontWeight: 600, color: '#f5f5f7' }}>{d.name}</td>
                            <td>{d.as_id}</td>
                            <td><span style={{ color: 'var(--accent-color)' }}>{d.daemon_type}</span></td>
                            <td>{d.port}</td>
                            <td>{d.packet_count.toLocaleString()}</td>
                            <td>
                              <span style={{ color: d.status === 'running' ? 'var(--green)' : 'var(--orange)', fontWeight: 600 }}>
                                {d.status}
                              </span>
                            </td>
                          </tr>
                        )) : (
                          <tr><td colSpan={6} style={{textAlign: 'center', padding: '16px', color: 'var(--text-secondary)'}}>No SCION daemons detected</td></tr>
                        )}
                    </tbody>
                  </table>
                </div>
              )}

              {scionSubTab === 'paths' && (
                <div className="settings-list">
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
                      {scionPaths.length > 0 ? scionPaths.map((p, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600, color: 'var(--accent-color)' }}>{p.destination_as}</td>
                          <td>{p.hops.join(' → ')}</td>
                          <td style={{ color: '#00f0ff' }}>{p.latency_ms} ms</td>
                          <td>{p.mtu} B</td>
                          <td>{p.policy}</td>
                          <td>
                            <span style={{ color: p.is_active ? 'var(--green)' : 'var(--text-tertiary)', fontWeight: 600 }}>
                              {p.is_active ? 'Active' : 'Standby'}
                            </span>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={6} style={{textAlign: 'center', padding: '16px', color: 'var(--text-secondary)'}}>No SCION paths detected</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {scionSubTab === 'gns3' && (
                <div className="settings-list">
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
                      {gnsNodes.length > 0 ? gnsNodes.map((n) => (
                        <tr key={n.node_id}>
                          <td>{n.node_id}</td>
                          <td style={{ fontWeight: 600, color: '#f5f5f7' }}>{n.name}</td>
                          <td>{n.node_type}</td>
                          <td>{n.console_port}</td>
                          <td style={{ color: 'var(--accent-color)' }}>{n.as_mapping}</td>
                          <td>
                            <span style={{ color: n.status === 'started' ? 'var(--green)' : 'var(--orange)', fontWeight: 600 }}>
                              {n.status}
                            </span>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={6} style={{textAlign: 'center', padding: '16px', color: 'var(--text-secondary)'}}>No Virtual Nodes detected</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: EXTERNAL LLMS */}
          {activeTab === 'llm' && (
            <div className="ndi-container">
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
                    <option value="codex">OpenAI Codex</option>
                    <option value="trae">Trae Agent</option>
                  </select>
                </div>

                <div className="ndi-divider" />

                <div className="ndi-row">
                  <span className="ndi-label">Model:</span>
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
                      </>
                    )}
                    {llmProvider === 'codex' && (
                      <>
                        <option value="gpt-4o">gpt-4o</option>
                        <option value="gpt-4o-mini">gpt-4o-mini</option>
                      </>
                    )}
                    {llmProvider === 'trae' && (
                      <option value="trae-agent-v1">trae-agent-v1 (Local Daemon)</option>
                    )}
                  </select>
                </div>

                <div className="ndi-divider" />

                <div className="ndi-row">
                  <span className="ndi-label">API Key:</span>
                  <input 
                    type="password"
                    className="ndi-select"
                    style={{ cursor: 'text' }}
                    placeholder="Enter API Key"
                    value={llmApiKey}
                    onChange={(e) => setLlmApiKey(e.target.value)}
                  />
                </div>
              </div>

              <div className="ndi-card">
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#e5e5e7', marginBottom: '8px' }}>
                  Prompt
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
                    {llmLoading ? 'Querying...' : `Query ${llmProvider}`}
                  </button>
                </div>
              </div>

              {llmResponse && (
                <div className="ndi-card" style={{ background: '#1c1c1f', border: '1px solid rgba(0, 122, 255, 0.35)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#007aff' }}>
                      Response
                    </span>
                  </div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '12px', color: '#e5e5e7', fontFamily: 'monospace' }}>
                    {llmResponse}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SECURITY */}
          {activeTab === 'firewall' && (
            <div className="settings-list">
              <div className="settings-item" onClick={handleQuickClean} style={{ cursor: 'pointer' }}>
                <div className="item-icon-container bg-orange">
                  <HardDrive size={18} color="white" />
                </div>
                <div className="item-content">
                  <div className="item-title" style={{ color: 'var(--orange)' }}>Clear Application Caches</div>
                  <div className="item-subtitle">Purge local temporary logs and caches</div>
                </div>
                <Power size={16} color="var(--orange)" />
              </div>

              {cleanStatus && (
                <div style={{ 
                  padding: '10px 14px', 
                  background: 'rgba(52, 199, 89, 0.12)', 
                  border: '1px solid rgba(52, 199, 89, 0.35)', 
                  borderRadius: '8px', 
                  marginTop: '16px', 
                  fontSize: '12px', 
                  color: '#34c759' 
                }}>
                  {cleanStatus}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: ABOUT */}
          {activeTab === 'about' && (
            <div className="settings-list">
              <div className="settings-item">
                <div className="item-icon-container bg-blue">
                  <Server size={18} color="white" />
                </div>
                <div className="item-content">
                  <div className="item-title">Omnia-Vault Desktop</div>
                  <div className="item-subtitle">
                    v0.2.1
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
