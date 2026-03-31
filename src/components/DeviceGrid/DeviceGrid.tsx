import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../../store';
import { useAdbCommands } from '../../hooks/useAdbCommands';
import { DeviceCard } from './DeviceCard';
import styles from './DeviceGrid.module.css';

export function DeviceGrid() {
  const devices = useStore((s) => s.devices);
  const disabledSerials = useStore((s) => s.disabledSerials);
  const selectedSerials = useStore((s) => s.selectedSerials);
  const screenshots = useStore((s) => s.screenshots);
  const page = useStore((s) => s.page);
  const pageSize = useStore((s) => s.pageSize);
  const setPage = useStore((s) => s.setPage);
  const fps = useStore((s) => s.fps);

  const setPageSize = useStore((s) => s.setPageSize);
  const cmds = useAdbCommands();

  const enabledDevices = devices.filter((d) => !disabledSerials.has(d.serial));
  const totalPages = Math.max(1, Math.ceil(enabledDevices.length / pageSize));
  const pageDevices = enabledDevices.slice(page * pageSize, (page + 1) * pageSize);

  // Track previous page serials to start/stop previews on page change
  const prevSerialsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentOnlineDevices = pageDevices.filter((d) => d.status === 'online');
    const currentSerials = new Set(currentOnlineDevices.map((d) => d.serial));
    const prev = prevSerialsRef.current;

    // Stop preview for devices no longer on current page
    for (const serial of prev) {
      if (!currentSerials.has(serial)) {
        invoke('stop_preview', { serial }).catch(() => {});
      }
    }

    const newDevices = currentOnlineDevices.filter((d) => !prev.has(d.serial));

    // Start preview for new devices on current page
    for (const d of newDevices) {
      invoke('start_preview', {
        serial: d.serial,
        fps,
        serverHost: d.server_host,
        serverPort: d.server_port,
      }).catch(() => {});
    }

    // Auto wake up only newly appeared devices on current page
    if (newDevices.length > 0) {
      cmds.wakeUpDevices(
        newDevices.map((d) => ({
          serial: d.serial,
          width: d.screen_width,
          height: d.screen_height,
          server_host: d.server_host,
          server_port: d.server_port,
        }))
      ).catch(() => {});
    }

    prevSerialsRef.current = currentSerials;
  }, [page, pageDevices.map((d) => `${d.serial}:${d.status}`).join(','), fps, cmds]);

  if (devices.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>📱</div>
        <div className={styles.emptyText}>No devices connected</div>
        <div className={styles.emptyHint}>Add an ADB server in the sidebar to get started</div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.grid}>
        {pageDevices.map((device) => (
          <DeviceCard
            key={device.serial}
            device={device}
            screenshot={screenshots[device.serial]}
            selected={selectedSerials.has(device.serial)}
          />
        ))}
      </div>
      {devices.length > 0 && (
        <div className={styles.pagination}>
          <div className={styles.pageSizeWrap}>
            <span className={styles.pageSizeLabel}>Per page</span>
            <select
              className={styles.pageSizeSelect}
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {[6, 8, 10, 12, 14, 16, 20, 24].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          {totalPages > 1 && (
            <>
              <button
                className={styles.pageBtn}
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                ◀
              </button>
              <span className={styles.pageInfo}>
                {page + 1} / {totalPages}
              </span>
              <button
                className={styles.pageBtn}
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                ▶
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
