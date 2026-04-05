import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ScanResult } from "../../types";
import styles from "./ScanDialog.module.css";

const SCAN_STORAGE_KEY = "phonecontrol_scan_config";

function loadScanConfig(): {
  host: string;
  startPort: string;
  endPort: string;
} {
  try {
    const saved = localStorage.getItem(SCAN_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return { host: "", startPort: "5555", endPort: "5555" };
}

function saveScanConfig(host: string, startPort: string, endPort: string) {
  try {
    localStorage.setItem(
      SCAN_STORAGE_KEY,
      JSON.stringify({ host, startPort, endPort }),
    );
  } catch {}
}

interface Props {
  onClose: () => void;
}

export function ScanDialog({ onClose }: Props) {
  const saved = loadScanConfig();
  const [host, setHost] = useState(saved.host);
  const [startPort, setStartPort] = useState(saved.startPort);
  const [endPort, setEndPort] = useState(saved.endPort);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [error, setError] = useState("");

  // Save to localStorage when inputs change
  useEffect(() => {
    saveScanConfig(host, startPort, endPort);
  }, [host, startPort, endPort]);

  async function startScan() {
    if (!host.trim()) {
      setError("请输入IP地址");
      return;
    }

    const start = parseInt(startPort) || 5555;
    const end = parseInt(endPort) || 5555;

    if (start > end) {
      setError("起始端口不能大于结束端口");
      return;
    }

    setScanning(true);
    setError("");
    setResults([]);

    try {
      const scanResults = await invoke<ScanResult[]>("scan_adb_devices", {
        host: host.trim(),
        startPort: start,
        endPort: end,
      });
      setResults(scanResults);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setScanning(false);
    }
  }

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.dialog}>
        <div className={styles.header}>
          <span className={styles.title}>扫描设备</span>
          <button className={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.inputGroup}>
            <label>IP地址</label>
            <input
              className={styles.input}
              placeholder="例如: 192.168.1.100"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              disabled={scanning}
            />
          </div>

          <div className={styles.portRange}>
            <div className={styles.inputGroup}>
              <label>起始端口</label>
              <input
                className={styles.input}
                type="number"
                placeholder="5555"
                value={startPort}
                onChange={(e) => setStartPort(e.target.value)}
                disabled={scanning}
              />
            </div>
            <span className={styles.rangeSep}>-</span>
            <div className={styles.inputGroup}>
              <label>结束端口</label>
              <input
                className={styles.input}
                type="number"
                placeholder="5555"
                value={endPort}
                onChange={(e) => setEndPort(e.target.value)}
                disabled={scanning}
              />
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button
            className={styles.scanBtn}
            onClick={startScan}
            disabled={scanning}
          >
            {scanning ? "扫描中..." : "开始扫描"}
          </button>

          {results.length > 0 && (
            <div className={styles.results}>
              <div className={styles.resultsTitle}>已自动添加到设备列表</div>
              <div className={styles.resultsList}>
                {results.map((result, idx) => (
                  <div key={idx} className={styles.resultItem}>
                    <span className={styles.resultAddr}>
                      {result.ip}:{result.port}
                    </span>
                    <span className={styles.resultMsg}>{result.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!scanning && results.length === 0 && error === "" && (
            <div className={styles.hint}>
              输入IP和端口范围，点击开始扫描。系统会尝试使用 adb connect
              连接每个端口。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
