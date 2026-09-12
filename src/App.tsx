import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Wifi, 
  ChevronRight, 
  ChevronLeft,
  Server,
  Activity,
  HardDrive,
  Info,
  Cpu,
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
  const [isOpeningChecks, setIsOpeningChecks] = useState(false);
  const [connectionChecksError, setConnectionChecksError] = useState<string | null>(null);

  // SCION Subtabs & Entities
  const [scionSubTab, setScionSubTab] = useState<'valves' | 'daemons' | 'paths' | 'gns3'>('valves');

  const [scionDaemons, setScionDaemons] = useState<ScionDaemonEntity[]>([]);
  const [scionPaths, setScionPaths] = useState<ScionPathEntity[]>([]);
  const [gnsNodes, setGnsNodes] = useState<Gns3TopologyNode[]>([]);

  // These observations describe the legacy GNS3 helper, not application routing.
  const [tunnel, setTunnel] = useState<TunnelStatus | null>(null);
  const [tunnelCheckedAt, setTunnelCheckedAt] = useState<Date | null>(null);
  const [tunnelError, setTunnelError] = useState<string | null>(null);
  const [isRefreshingTunnel, setIsRefreshingTunnel] = useState(false);
  const tunnelReadInFlight = useRef(false);

  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);

  const refreshTunnel = useCallback(async () => {
    if (tunnelReadInFlight.current) return;
    tunnelReadInFlight.current = true;
    setIsRefreshingTunnel(true);
    try {
      const observation = await invoke<TunnelStatus>('get_tunnel_status');
      setTunnel(observation);
      setTunnelCheckedAt(new Date());
      setTunnelError(null);
    } catch {
      setTunnel(null);
      setTunnelError('Helper status could not be read. Connection status remains unverified.');
    } finally {
      tunnelReadInFlight.current = false;
      setIsRefreshingTunnel(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch from backend
    invoke<SystemMetrics>('get_system_metrics').then(setMetrics).catch(() => {});
    void refreshTunnel();
    invoke<ScionDaemonEntity[]>('get_scion_daemons').then(setScionDaemons).catch(() => {});
    invoke<ScionPathEntity[]>('get_scion_routing_paths').then(setScionPaths).catch(() => {});
    invoke<Gns3TopologyNode[]>('get_gns3_nodes').then(setGnsNodes).catch(() => {});

    // Listen to real-time events from background tray monitor
    const unlisteners: (() => void)[] = [];
    
    listen<SystemMetrics>('system-metrics-update', (event) => setMetrics(event.payload)).then(u => unlisteners.push(u));
    listen<string>('navigate-tab', (event) => setActiveTab(event.payload)).then(u => unlisteners.push(u));
    listen<string>('connection-checks-error', (event) => {
      setConnectionChecksError(event.payload);
      setActiveTab('network');
      setScionSubTab('valves');
    }).then(u => unlisteners.push(u));

    // Polling fallback
    const timer = setInterval(() => {
      invoke<SystemMetrics>('get_system_metrics').then(setMetrics).catch(() => {});
      void refreshTunnel();
    }, 2500);

    return () => {
      clearInterval(timer);
      unlisteners.forEach(u => u());
    };
  }, [refreshTunnel]);

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

  const openConnectionChecks = async () => {
    setIsOpeningChecks(true);
    setConnectionChecksError(null);
    try {
      await invoke<void>('open_connection_checks');
    } catch (error) {
      setConnectionChecksError(`Could not open connection checks: ${String(error)}`);
    } finally {
      setIsOpeningChecks(false);
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
              background: '#8e8e93',
              color: 'white',
              fontSize: '9px',
              padding: '1px 6px',
              borderRadius: '4px',
              fontWeight: 700
            }}>
              UNVERIFIED
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
                      {metrics.os_name} &middot; Memory used: {metrics.memory_percent.toFixed(0)}%
                    </div>
                    <div className="mole-spec-badge">
                      {(metrics.memory_total_mb / 1024).toFixed(0)} GB &middot; {metrics.cpu_cores} Processor cores &middot; up {formatUptime(metrics.uptime_secs)}
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
                  Connection details
                </button>
                <button 
                  className={`subtab-btn ${scionSubTab === 'daemons' ? 'active' : ''}`}
                  onClick={() => setScionSubTab('daemons')}
                >
                  Services
                </button>
                <button 
                  className={`subtab-btn ${scionSubTab === 'paths' ? 'active' : ''}`}
                  onClick={() => setScionSubTab('paths')}
                >
                  Routes
                </button>
                <button 
                  className={`subtab-btn ${scionSubTab === 'gns3' ? 'active' : ''}`}
                  onClick={() => setScionSubTab('gns3')}
                >
                  Test network
                </button>
              </div>

              {scionSubTab === 'valves' && (
                <>
                  <div className="settings-list" style={{ marginTop: '16px' }}>
                    <div className="settings-item">
                      <div className="status-dot status-orange" />
                      <div className="item-content">
                        <div className="item-title">Connection not verified</div>
                        <div className="item-subtitle" style={{ lineHeight: 1.5 }}>
                          SCION use by Codex and Antigravity has not been verified here.
                          A proxy flag or running helper cannot confirm their connection.
                        </div>
                      </div>
                    </div>
                    <div className="settings-item">
                      <div className="item-content">
                        <div className="item-title">Check a new SCION connection</div>
                        <div className="item-subtitle" style={{ lineHeight: 1.5 }}>
                          Opens Connections in System Settings. Choose Check SCION there to see
                          the VPN, local services, and a strict SCION connection test. A successful
                          test does not prove that an existing model session uses SCION.
                        </div>
                      </div>
                      <button
                        onClick={() => void openConnectionChecks()}
                        disabled={isOpeningChecks}
                        style={{ background: '#007aff', border: 'none', color: 'white', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', cursor: isOpeningChecks ? 'wait' : 'pointer', marginLeft: '12px', flexShrink: 0 }}
                      >
                        {isOpeningChecks ? 'Opening…' : 'Check connection'}
                      </button>
                    </div>
                  </div>
                  {connectionChecksError && (
                    <div role="alert" style={{ color: 'var(--orange)', fontSize: '12px', marginTop: '10px' }}>
                      {connectionChecksError}
                    </div>
                  )}
                  <div className="valve-grid" style={{ marginTop: '16px' }}>
                    <div className="valve-card closed">
                      <div className="valve-header">
                        <span className="valve-title">
                          <span style={{ fontSize: '18px' }}>🌐</span> Automatic proxy
                        </span>
                        <span className="valve-badge valve-badge-off">
                          Not checked
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        This page does not read macOS proxy settings or verify which apps use the proxy.
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        <span>Latency: Not measured</span>
                      </div>
                    </div>

                    <div className="valve-card closed">
                      <div className="valve-header">
                        <span className="valve-title">
                          <Server size={18} /> GNS3 management helper
                        </span>
                        <span className="valve-badge valve-badge-off">
                          {tunnel ? (tunnel.is_running ? 'Process running' : 'No process reported') : 'Unavailable'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        Reports the legacy helper process only. This does not identify the route used by SCION or your apps.
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        <span>Local port 3080: {tunnel ? (tunnel.port_responding ? 'TCP connection accepted' : 'No TCP response') : 'Not checked'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="settings-list" style={{ marginTop: '16px' }}>
                    <div className="settings-item">
                      <div className="item-icon-container bg-gray">
                        <Server size={18} color="white" />
                      </div>
                      <div className="item-content">
                        <div className="item-title">GNS3 helper observations</div>
                        <div className="item-subtitle" style={{ lineHeight: 1.5 }}>
                          {tunnel ? `Service: ${tunnel.label} · PID: ${tunnel.pid ?? 'Not reported'}` : 'No current helper observation'}
                          <br />
                          {tunnelCheckedAt ? `Last successful read: ${tunnelCheckedAt.toLocaleTimeString()}` : 'No successful read yet'}
                        </div>
                      </div>
                      <button 
                        onClick={() => void refreshTunnel()}
                        disabled={isRefreshingTunnel}
                        title="Read helper process status and check the local management port. Does not change routing."
                        style={{ background: '#38383e', border: 'none', color: 'white', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', cursor: isRefreshingTunnel ? 'wait' : 'pointer', marginRight: '8px' }}
                      >
                        {isRefreshingTunnel ? 'Reading…' : 'Refresh helper status'}
                      </button>
                    </div>
                  </div>
                  {tunnelError && (
                    <div role="status" style={{
                      padding: '10px 14px', 
                      background: 'rgba(0, 122, 255, 0.12)', 
                      border: '1px solid rgba(0, 122, 255, 0.35)', 
                      borderRadius: '8px', 
                      marginTop: '16px', 
                      fontSize: '12px', 
                      color: '#007aff' 
                    }}>
                      {tunnelError}
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
                          <tr><td colSpan={6} style={{textAlign: 'center', padding: '16px', color: 'var(--text-secondary)'}}>Service data unavailable</td></tr>
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
                        <tr><td colSpan={6} style={{textAlign: 'center', padding: '16px', color: 'var(--text-secondary)'}}>Route data unavailable</td></tr>
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
                        <tr><td colSpan={6} style={{textAlign: 'center', padding: '16px', color: 'var(--text-secondary)'}}>GNS3 node data unavailable</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ABOUT */}
          {activeTab === 'about' && (
            <div className="settings-list">
              <div className="settings-item">
                <div className="item-icon-container bg-blue">
                  <Server size={18} color="white" />
                </div>
                <div className="item-content">
                  <div className="item-title">Omnia-Vault Desktop</div>
                  <div className="item-subtitle">
                    v0.2.2
                  </div>
                </div>
              </div>

              <div className="settings-item" onClick={handleQuickClean} style={{ cursor: 'pointer', marginTop: '16px' }}>
                <div className="item-icon-container bg-orange">
                  <HardDrive size={18} color="white" />
                </div>
                <div className="item-content">
                  <div className="item-title" style={{ color: 'var(--orange)' }}>Review app files</div>
                  <div className="item-subtitle">Clean local application caches</div>
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
        </div>
      </main>
    </div>
  );
}
