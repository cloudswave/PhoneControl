import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from './store';
import { useDevices } from './hooks/useDevices';
import { useScreenshot } from './hooks/useScreenshot';
import { Sidebar } from './components/Sidebar/Sidebar';
import { DeviceGrid } from './components/DeviceGrid/DeviceGrid';
import { Toolbar } from './components/Toolbar/Toolbar';
import type { AdbServer } from './types';
import styles from './App.module.css';

export default function App() {
  const setServers = useStore((s) => s.setServers);

  useDevices();
  useScreenshot();

  useEffect(() => {
    invoke<AdbServer[]>('load_config').then(setServers).catch(() => {});
  }, [setServers]);

  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.main}>
        <div className={styles.content}>
          <DeviceGrid />
        </div>
        <Toolbar />
      </div>
    </div>
  );
}
