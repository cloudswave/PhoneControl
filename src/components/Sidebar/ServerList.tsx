import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../../store';
import type { AdbServer } from '../../types';
import { ScanDialog } from '../ScanDialog/ScanDialog';
import styles from './ServerList.module.css';

export function ServerList() {
  const servers = useStore((s) => s.servers);
  const setServers = useStore((s) => s.setServers);
  const [host, setHost] = useState('');
  const [port, setPort] = useState('5037');
  const [error, setError] = useState('');
  const [showScan, setShowScan] = useState(false);

  async function addServer() {
    const h = host.trim();
    if (!h) return;
    try {
      const srv = await invoke<AdbServer>('add_server', { host: h, port: parseInt(port) || 5037 });
      setServers([...servers, srv]);
      setHost('');
      setError('');
    } catch (e: any) {
      setError(String(e));
    }
  }

  async function removeServer(id: string) {
    await invoke('remove_server', { id });
    setServers(servers.filter((s) => s.id !== id));
  }

  async function toggleServer(id: string, enabled: boolean) {
    await invoke('toggle_server', { id, enabled });
    setServers(servers.map((s) => (s.id === id ? { ...s, enabled } : s)));
    // 切换 server 状态后自动刷新设备列表
    invoke('refresh_devices').catch(() => {});
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.title}>
        <span>ADB Servers</span>
        <button className={styles.scanBtn} onClick={() => setShowScan(true)} title="扫描设备">
          🔍 扫描
        </button>
      </div>

      <div className={styles.addRow}>
        <input
          className={styles.input}
          placeholder="host"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addServer()}
        />
        <input
          className={styles.portInput}
          placeholder="port"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addServer()}
        />
        <button className={styles.addBtn} onClick={addServer}>+</button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.list}>
        {servers.map((srv) => (
          <div key={srv.id} className={styles.item}>
            <div
              className={`${styles.dot} ${srv.enabled ? styles.dotOn : styles.dotOff}`}
              onClick={() => toggleServer(srv.id, !srv.enabled)}
              title={srv.enabled ? 'Click to disable' : 'Click to enable'}
            />
            <span className={styles.addr}>{srv.host}:{srv.port}</span>
            <button className={styles.removeBtn} onClick={() => removeServer(srv.id)}>×</button>
          </div>
        ))}
      </div>

      {showScan && <ScanDialog onClose={() => setShowScan(false)} />}
    </div>
  );
}
