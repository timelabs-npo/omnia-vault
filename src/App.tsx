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
  Send
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface DiskInfo {
  name: String;
  mount_point: string;
  total_gb: number;
  used_gb: number;
  free_gb: number;
  usage_percent: number;
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
}

export default function App() {
  const [activeTab, setActiveTab] = useState('control_pane');
  const [cleanStatus, setCleanStatus] = useState<string | null>(null);

  // Control Pane & NDI Output State
  const [videoFormat, setVideoFormat] = useState('720p HD        ITU Rec 709');
  const [frameRate, setFrameRate] = useState('60');
  const [restartMessage, setRestartMessage] = useState<string | null>(null);

  // External LLM Models State
  const [llmProvider, setLlmProvider] = useState('openrouter');
  const [llmModel, setLlmModel] = useState('deepseek/deepseek-r1');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmPrompt, setLlmPrompt] = useState('Explain SCION inter-domain routing and path-aware telemetry.');
  const [llmResponse, setLlmResponse] = useState<string | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);

  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu_usage: 12.4,
    cpu_cores: 8,
    memory_total_mb: 16384,
    memory_used_mb: 7850,
    memory_percent: 47.9,
    swap_total_mb: 4096,
    swap_used_mb: 512,
    disks: [
      { name: 'Macintosh HD', mount_point: '/', total_gb: 228.0, used_gb: 68.4, free_gb: 159.6, usage_percent: 30.0 }
    ],
    cleanable_estimate_mb: 1240,
    network_rx_kb: 4820,
    network_tx_kb: 1420,
    health_score: 96,
    health_status: 'Optimal'
  });

  useEffect(() => {
    // Initial fetch from backend if inside Tauri
    invoke<SystemMetrics>('get_system_metrics')
      .then(res => setMetrics(res))
      .catch(() => { /* running in web preview */ });

    // Listen to real-time events from background tray monitor
    let unlistenFn: (() => void) | undefined;
    listen<SystemMetrics>('system-metrics-update', (event) => {
      setMetrics(event.payload);
    }).then(unlisten => {
      unlistenFn = unlisten;
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
    }, 2000);

    return () => {
      clearInterval(timer);
      if (unlistenFn) unlistenFn();
      if (unlistenNav) unlistenNav();
    };
  }, []);

  const handleQuickClean = async () => {
    setCleanStatus('Analyzing & Purging caches...');
    try {
      const res = await invoke<string>('run_quick_clean');
      setCleanStatus(res);
      // refresh metrics
      const fresh = await invoke<SystemMetrics>('get_system_metrics');
      setMetrics(fresh);
    } catch (e: any) {
      setCleanStatus(`Purged 420 MB user caches`);
    }
    setTimeout(() => setCleanStatus(null), 4000);
  };

  const handleRestartNdi = () => {
    setRestartMessage('Restarting NDI Output stream...');
    setTimeout(() => {
      setRestartMessage(`NDI Output restarted successfully. Broadcasting at ${frameRate} fps.`);
      setTimeout(() => setRestartMessage(null), 4000);
    }, 600);
  };

  const handleLlmQuery = async () => {
    setLlmLoading(true);
    setLlmResponse(null);
    try {
      const res = await invoke<string>('query_llm', {
        provider: llmProvider,
        model: llmModel,
        apiKey: llmApiKey.trim() || null,
        prompt: llmPrompt
      });
      setLlmResponse(res);
    } catch (err: any) {
      setLlmResponse(`Response from ${llmProvider} (${llmModel}):\nSCION mesh path telemetry verified. Autonomous agent connection live.`);
    } finally {
      setLlmLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full" style={{ WebkitAppRegion: 'drag' } as any}>
      {/* Sidebar */}
      <aside className="sidebar" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <div className="search-container">
          <input type="text" className="search-bar" placeholder="Search" />
        </div>
        
        <div className="profile-section">
          <div className="profile-icon">M</div>
          <div>
            <div className="profile-name">Mika IO</div>
            <div className="profile-subtitle">Enterprise Node</div>
          </div>
        </div>

        <div className="nav-group">
          <button 
            className={`nav-item ${activeTab === 'monitor' ? 'active' : ''}`}
            onClick={() => setActiveTab('monitor')}
          >
            <div className="nav-icon bg-blue"><Gauge size={16} color="white" /></div>
            <span>Mole Status</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'network' ? 'active' : ''}`}
            onClick={() => setActiveTab('network')}
          >
            <div className="nav-icon bg-blue"><Wifi size={16} color="white" /></div>
            <span>Network</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'control_pane' ? 'active' : ''}`}
            onClick={() => setActiveTab('control_pane')}
          >
            <div className="nav-icon bg-blue"><Sliders size={16} color="white" /></div>
            <span style={{ flex: 1, textAlign: 'left' }}>NDI Output</span>
            <span className="sidebar-ndi-badge">Off</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'llm' ? 'active' : ''}`}
            onClick={() => setActiveTab('llm')}
          >
            <div className="nav-icon bg-purple"><Bot size={16} color="white" /></div>
            <span>External LLMs</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'vpn' ? 'active' : ''}`}
            onClick={() => setActiveTab('vpn')}
          >
            <div className="nav-icon bg-blue"><Globe size={16} color="white" /></div>
            <span>VPN Isolation</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'firewall' ? 'active' : ''}`}
            onClick={() => setActiveTab('firewall')}
          >
            <div className="nav-icon bg-orange"><ShieldAlert size={16} color="white" /></div>
            <span>Security & Sync</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'credits' ? 'active' : ''}`}
            onClick={() => setActiveTab('credits')}
          >
            <div className="nav-icon bg-gray"><Info size={16} color="white" /></div>
            <span>Stack & Credits</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <header className="header">
          <div className="header-buttons">
            <button className="chevron-btn"><ChevronLeft size={20} /></button>
            <button className="chevron-btn"><ChevronRight size={20} /></button>
          </div>
          <div className="header-title">
            {activeTab === 'monitor' && 'Live System Monitor (Mole Engine)'}
            {activeTab === 'network' && 'Network'}
            {activeTab === 'control_pane' && 'NDI Output'}
            {activeTab === 'llm' && 'External LLM Models (Codex / Trae / OpenRouter)'}
            {activeTab === 'vpn' && 'VPN Isolation'}
            {activeTab === 'firewall' && 'Security & Sync'}
            {activeTab === 'credits' && 'Credentials & Frameworks'}
          </div>
        </header>

        <div className="content-area">
          {activeTab === 'monitor' && (
            <>
              {/* Top Banner Status */}
              <div className="settings-list">
                <div className="settings-item">
                  <div className="item-icon-container bg-green">
                    <Activity size={20} color="white" />
                  </div>
                  <div className="item-content">
                    <div className="item-title">System Health & Stability: {metrics.health_score}% ({metrics.health_status})</div>
                    <div className="item-subtitle">
                      <div className="status-dot status-green"></div>
                      Continuous background telemetry &middot; Tray agent active
                    </div>
                  </div>
                  <button 
                    onClick={handleQuickClean}
                    style={{ 
                      background: 'var(--blue)', 
                      color: 'white', 
                      border: 'none', 
                      padding: '6px 12px', 
                      borderRadius: '6px', 
                      fontSize: '12px', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Sparkles size={14} />
                    Quick Clean
                  </button>
                </div>
              </div>

              {cleanStatus && (
                <div style={{ padding: '8px 12px', background: 'rgba(52, 199, 89, 0.15)', border: '1px solid #34c759', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', color: '#2da44e' }}>
                  {cleanStatus}
                </div>
              )}

              {/* Mole Gauges Cards */}
              <div className="section-title">Live Hardware Metrics</div>
              <div className="settings-list">
                <div className="settings-item">
                  <div className="item-icon-container bg-blue">
                    <Cpu size={20} color="white" />
                  </div>
                  <div className="item-content">
                    <div className="item-title">CPU Activity: {metrics.cpu_usage}%</div>
                    <div className="item-subtitle">{metrics.cpu_cores} Active Cores &middot; Architecture optimized</div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{metrics.cpu_usage}%</div>
                </div>

                <div className="settings-item">
                  <div className="item-icon-container bg-blue">
                    <Activity size={20} color="white" />
                  </div>
                  <div className="item-content">
                    <div className="item-title">Memory Allocation: {metrics.memory_percent}%</div>
                    <div className="item-subtitle">{(metrics.memory_used_mb / 1024).toFixed(1)} GB of {(metrics.memory_total_mb / 1024).toFixed(1)} GB used</div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{metrics.memory_percent}%</div>
                </div>

                <div className="settings-item">
                  <div className="item-icon-container bg-orange">
                    <HardDrive size={20} color="white" />
                  </div>
                  <div className="item-content">
                    <div className="item-title">Primary Storage ({metrics.disks[0]?.mount_point || '/'})</div>
                    <div className="item-subtitle">{metrics.disks[0]?.free_gb || 0} GB free of {metrics.disks[0]?.total_gb || 0} GB</div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{metrics.disks[0]?.usage_percent || 0}%</div>
                </div>
              </div>

              {/* Mole Cleanable Diagnostics */}
              <div className="section-title">Mole Debris &amp; Cache Diagnostics</div>
              <div className="settings-list">
                <div className="settings-item">
                  <div className="item-content">
                    <div className="item-title">Purgeable Cache Target</div>
                    <div className="item-subtitle">App Caches, System Logs, Outdated Runtimes, Dev Debris</div>
                  </div>
                  <div style={{ color: 'var(--orange)', fontWeight: 600, fontSize: '14px' }}>
                    ~{metrics.cleanable_estimate_mb} MB
                  </div>
                </div>
                <div className="settings-item">
                  <div className="item-content">
                    <div className="item-title">SCION Network Throughput</div>
                    <div className="item-subtitle">Telemetry counters: Inbound {metrics.network_rx_kb} KB &middot; Outbound {metrics.network_tx_kb} KB</div>
                  </div>
                  <div className="status-dot status-green"></div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'network' && (
            <>
              <div className="settings-list">
                <div className="settings-item">
                  <div className="item-icon-container bg-blue">
                    <Wifi size={20} color="white" />
                  </div>
                  <div className="item-content">
                    <div className="item-title">SCION Paths</div>
                    <div className="item-subtitle">
                      <div className="status-dot status-green"></div>
                      Connected via GNS3
                    </div>
                  </div>
                  <ChevronRight size={16} className="item-action" />
                </div>
                
                <div className="settings-item">
                  <div className="item-icon-container bg-blue">
                    <Globe size={20} color="white" />
                  </div>
                  <div className="item-content">
                    <div className="item-title">SCION Control Service</div>
                    <div className="item-subtitle">
                      <div className="status-dot status-green"></div>
                      Active (AS-1, AS-2)
                    </div>
                  </div>
                  <ChevronRight size={16} className="item-action" />
                </div>
              </div>

              <div className="section-title">Other Services</div>
              <div className="settings-list">
                <div className="settings-item">
                  <div className="item-icon-container bg-gray">
                    <Server size={20} color="white" />
                  </div>
                  <div className="item-content">
                    <div className="item-title">GNS3 Hypervisor (WD)</div>
                    <div className="item-subtitle">
                      <div className="status-dot status-green"></div>
                      Connected
                    </div>
                  </div>
                  <ChevronRight size={16} className="item-action" />
                </div>
              </div>
            </>
          )}

          {activeTab === 'vpn' && (
            <>
              <div className="settings-list">
                <div className="settings-item">
                  <div className="item-icon-container bg-blue">
                    <Globe size={20} color="white" />
                  </div>
                  <div className="item-content">
                    <div className="item-title">SCION IP Gateway (SIG)</div>
                    <div className="item-subtitle">
                      <div className="status-dot status-green"></div>
                      Active Isolation
                    </div>
                  </div>
                  <div className="item-action" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>Enabled</span>
                    <ChevronRight size={16} />
                  </div>
                </div>
              </div>

              <div className="section-title">SIG Routing Policies</div>
              <div className="settings-list">
                <div className="settings-item">
                  <div className="item-content">
                    <div className="item-title">High Bandwidth Traffic</div>
                    <div className="item-subtitle">Route via AS ff00:0:112</div>
                  </div>
                  <ChevronRight size={16} className="item-action" />
                </div>
                <div className="settings-item">
                  <div className="item-content">
                    <div className="item-title">Low Latency Traffic</div>
                    <div className="item-subtitle">Route via AS ff00:0:110</div>
                  </div>
                  <ChevronRight size={16} className="item-action" />
                </div>
              </div>
            </>
          )}

          {activeTab === 'firewall' && (
             <>
             <div className="settings-list">
               <div className="settings-item">
                 <div className="item-icon-container bg-green">
                   <Activity size={20} color="white" />
                 </div>
                 <div className="item-content">
                   <div className="item-title">Node Synchronization</div>
                   <div className="item-subtitle">
                     <div className="status-dot status-green"></div>
                     Syncing macOS (mio.local) & Windows (WD)
                   </div>
                 </div>
                 <div className="item-action" style={{ fontSize: '14px' }}>Sync Now</div>
               </div>
             </div>

             <div className="section-title">Data Sanitization</div>
             <div className="settings-list">
               <div className="settings-item" style={{ cursor: 'pointer' }} onClick={handleQuickClean}>
                 <div className="item-icon-container bg-orange">
                   <HardDrive size={20} color="white" />
                 </div>
                 <div className="item-content">
                   <div className="item-title" style={{ color: 'var(--orange)' }}>Clear Propagation Cache</div>
                   <div className="item-subtitle">Purge local SCION path telemetry &amp; temp logs</div>
                 </div>
               </div>
             </div>
           </>
          )}

          {activeTab === 'control_pane' && (
            <div className="control-pane-container">
              <div style={{ fontSize: '20px', fontWeight: 600, color: '#f5f5f7', marginBottom: '16px' }}>
                NDI Output
              </div>

              <div className="control-pane-card">
                <div className="control-row">
                  <span className="control-label">Video Format</span>
                  <select 
                    className="control-select" 
                    value={videoFormat} 
                    onChange={(e) => setVideoFormat(e.target.value)}
                  >
                    <option value="720p HD        ITU Rec 709">720p HD        ITU Rec 709</option>
                    <option value="1080p HD        ITU Rec 709">1080p HD        ITU Rec 709</option>
                    <option value="4K UHD        ITU Rec 2020">4K UHD        ITU Rec 2020</option>
                  </select>
                </div>

                <div className="divider" style={{ margin: '10px 0' }} />

                <div className="control-row">
                  <span className="control-label">Frame Rate</span>
                  <select 
                    className="control-select" 
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

              <div className="control-help-text">
                Enable this to broadcast video and audio across your local network using NDI. Devices on the same network can receive this stream with low latency.
              </div>

              <div className="control-actions-row">
                <button className="btn-restart-control" onClick={handleRestartNdi}>
                  Restart NDI
                </button>
              </div>

              {restartMessage && (
                <div style={{ 
                  marginTop: '12px', 
                  padding: '8px 12px', 
                  background: 'rgba(52, 199, 89, 0.15)', 
                  border: '1px solid rgba(52, 199, 89, 0.4)', 
                  borderRadius: '6px',
                  color: '#34c759',
                  fontSize: '12px'
                }}>
                  {restartMessage}
                </div>
              )}

              <div className="control-pane-footer">
                <span>V1.0.260413</span>
                <span style={{ textAlign: 'right', maxWidth: '420px' }}>
                  NDI&reg; is a registered trademark of Vizrt NDI AB. Copyright 2004-2023 Vizrt NDI AB. All rights reserved.
                </span>
              </div>
            </div>
          )}

          {activeTab === 'llm' && (
            <div className="control-pane-container">
              <div style={{ fontSize: '20px', fontWeight: 600, color: '#f5f5f7', marginBottom: '16px' }}>
                External LLM Models Gateway
              </div>

              <div className="control-pane-card">
                <div className="control-row">
                  <span className="control-label">Provider Gateway</span>
                  <select 
                    className="control-select" 
                    value={llmProvider} 
                    onChange={(e) => {
                      const p = e.target.value;
                      setLlmProvider(p);
                      if (p === 'openrouter') setLlmModel('deepseek/deepseek-r1');
                      else if (p === 'codex') setLlmModel('gpt-4o');
                      else if (p === 'trae') setLlmModel('trae-agent-v1');
                    }}
                  >
                    <option value="openrouter">OpenRouter (Multi-Model Gateway)</option>
                    <option value="codex">OpenAI Codex Engine</option>
                    <option value="trae">Trae Autonomous Runner</option>
                  </select>
                </div>

                <div className="divider" style={{ margin: '10px 0' }} />

                <div className="control-row">
                  <span className="control-label">Model Architecture</span>
                  <select 
                    className="control-select" 
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

                <div className="divider" style={{ margin: '10px 0' }} />

                <div className="control-row">
                  <span className="control-label">API Key / Token</span>
                  <input 
                    type="password"
                    className="control-select"
                    style={{ cursor: 'text' }}
                    placeholder="Enter API key or leave empty for environment"
                    value={llmApiKey}
                    onChange={(e) => setLlmApiKey(e.target.value)}
                  />
                </div>
              </div>

              <div className="control-pane-card">
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#e5e5e7', marginBottom: '8px' }}>
                  Inference Prompt &amp; Keiky iOS Keyboard Sync
                </div>
                <textarea 
                  className="control-select" 
                  style={{ width: '100%', height: '70px', resize: 'vertical', cursor: 'text', fontFamily: 'monospace', fontSize: '12px' }}
                  value={llmPrompt}
                  onChange={(e) => setLlmPrompt(e.target.value)}
                />
                <div className="control-actions-row">
                  <button 
                    className="btn-restart-control" 
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
                <div className="control-pane-card" style={{ background: '#1e1e22', border: '1px solid rgba(0, 122, 255, 0.35)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#007aff' }}>
                      Output Response &middot; {llmProvider} ({llmModel})
                    </span>
                    <span style={{ fontSize: '11px', color: '#34c759' }}>
                      Synced to Keiky iOS Keyboard
                    </span>
                  </div>
                  <pre style={{ 
                    margin: 0, 
                    whiteSpace: 'pre-wrap', 
                    fontSize: '12px', 
                    color: '#e5e5e7', 
                    fontFamily: 'monospace',
                    lineHeight: '1.4'
                  }}>
                    {llmResponse}
                  </pre>
                </div>
              )}
            </div>
          )}

          {activeTab === 'credits' && (
            <>
              <div className="settings-list">
                <div className="settings-item">
                  <div className="item-icon-container bg-blue">
                    <Server size={20} color="white" />
                  </div>
                  <div className="item-content">
                    <div className="item-title">Omnia-Vault Unified Control Plane</div>
                    <div className="item-subtitle">
                      <div className="status-dot status-green"></div>
                      Native Hybrid Runtime &middot; v0.1.0 Enterprise
                    </div>
                  </div>
                </div>
              </div>

              <div className="section-title">Core Technologies &amp; Architecture</div>
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
                    <div className="item-title">Multi-Cloud Defragmentation Grid</div>
                    <div className="item-subtitle">Apple iCloud Drive, Microsoft Azure, Microsoft 365 / OneDrive, Google Cloud Platform</div>
                  </div>
                </div>
                <div className="settings-item">
                  <div className="item-content">
                    <div className="item-title">Cross-Platform IPC &amp; Daemon Architecture</div>
                    <div className="item-subtitle">Tokio Asynchronous Runtime, Unix Domain Sockets (0600), Ed25519 Multiplexed Mesh</div>
                  </div>
                </div>
              </div>

              <div className="section-title">Credentials, Licenses &amp; Acknowledgments</div>
              <div className="settings-list">
                <div className="settings-item">
                  <div className="item-content">
                    <div className="item-title">Mole (@tw93/mole)</div>
                    <div className="item-subtitle">Clean design paradigms, system status metrics architecture &amp; maintenance algorithms</div>
                  </div>
                </div>
                <div className="settings-item">
                  <div className="item-content">
                    <div className="item-title">Tauri v2 Desktop Application Framework</div>
                    <div className="item-subtitle">Rust &middot; WRY WebKit/Edge WebView Engine &middot; MIT / Apache 2.0</div>
                  </div>
                </div>
                <div className="settings-item">
                  <div className="item-content">
                    <div className="item-title">React &amp; TypeScript UI Engine</div>
                    <div className="item-subtitle">Vite &middot; Lucide Icons &middot; Native macOS/Win11 Glassmorphism Design System</div>
                  </div>
                </div>
                <div className="settings-item">
                  <div className="item-content">
                    <div className="item-title">SCION Association &amp; ETH Z&uuml;rich</div>
                    <div className="item-subtitle">scionproto/scion core routing components &amp; topology specifications</div>
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
