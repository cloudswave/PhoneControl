
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "./store";
import { useDevices } from "./hooks/useDevices";
import { useScreenshot } from "./hooks/useScreenshot";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { DeviceGrid } from "./components/DeviceGrid/DeviceGrid";
import { Toolbar } from "./components/Toolbar/Toolbar";
import { AuthorizationDialog } from "./components/AuthorizationDialog";
import type { AdbServer } from "./types";
import styles from "./App.module.css";
import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from './store';
import { useDevices } from './hooks/useDevices';
import { useScreenshot } from './hooks/useScreenshot';
import { useStream } from './hooks/useStream';
import { Sidebar } from './components/Sidebar/Sidebar';
import { DeviceGrid } from './components/DeviceGrid/DeviceGrid';
import { Toolbar } from './components/Toolbar/Toolbar';
import type { AdbServer } from './types';
import styles from './App.module.css';

export default function App() {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const setServers = useStore((s) => s.setServers);

  useDevices();
  useScreenshot();
  useStream();

  useEffect(() => {
    // 检查授权状态
    checkAuthorization();
  }, []);

  const checkAuthorization = async () => {
    try {
      const authorized = await invoke<boolean>("check_authorization_status");
      setIsAuthorized(authorized);

      if (authorized) {
        // 已授权，加载应用配置
        loadAppConfig();
      }
    } catch (error) {
      console.error("检查授权失败:", error);
      setIsAuthorized(false);
    }
  };

  const loadAppConfig = () => {
    invoke<AdbServer[]>("load_config")
      .then((servers) => {
        setServers(servers);
        // 加载配置后立即刷新设备列表
        invoke("refresh_devices").catch(() => {});
      })
      .catch(() => {});
  };

  const handleAuthorized = () => {
    setIsAuthorized(true);
    loadAppConfig();
  };

  // 显示授权对话框
  if (isAuthorized === false) {
    return <AuthorizationDialog onAuthorized={handleAuthorized} />;
  }

  // 正在检查授权状态
  if (isAuthorized === null) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontSize: "18px",
        }}
      >
        正在检查授权状态...
      </div>
    );
  }

  // 已授权，显示主应用
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
