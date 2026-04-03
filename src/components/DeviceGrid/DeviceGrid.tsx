import { useEffect, useRef, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../../store';
import { useAdbCommands } from '../../hooks/useAdbCommands';
import { DeviceCard } from './DeviceCard';
import styles from './DeviceGrid.module.css';

const CARD_BASE_WIDTH = 200;
const SCREEN_BASE_HEIGHT = 356; // only the screen area scales
const FIXED_HEADER_HEIGHT = 33; // header: padding + font (fixed px)
const FIXED_FOOTER_HEIGHT = 30; // footer: padding + font (fixed px)
const GRID_GAP = 10;
const GRID_PADDING = 12;

function useAutoScale(
  containerRef: React.RefObject<HTMLDivElement | null>,
  count: number,
) {
  const [scale, setScale] = useState(1);

  const calcScale = useCallback(() => {
    if (count === 0 || !containerRef.current) {
      setScale(1);
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const availW = rect.width - GRID_PADDING * 2;
    const availH = rect.height - GRID_PADDING * 2;
    if (availW <= 0 || availH <= 0) return;

    // Try different column counts, pick the one that uses the largest scale while fitting.
    // Card height = FIXED_HEADER_HEIGHT + SCREEN_BASE_HEIGHT * scale + FIXED_FOOTER_HEIGHT
    // Header & footer use fixed px sizes, only the screen area scales.
    let best = 0;
    for (let cols = 1; cols <= count; cols++) {
      const rows = Math.ceil(count / cols);
      const maxCardW = (availW - GRID_GAP * (cols - 1)) / cols;
      const maxCardH = (availH - GRID_GAP * (rows - 1)) / rows;
      const sx = maxCardW / CARD_BASE_WIDTH;
      const sy = (maxCardH - FIXED_HEADER_HEIGHT - FIXED_FOOTER_HEIGHT) / SCREEN_BASE_HEIGHT;
      if (sy <= 0) continue; // not enough room for even header+footer
      const s = Math.min(sx, sy);
      if (s > best) best = s;
    }
    setScale(Math.max(best, 0.1));
  }, [count, containerRef]);

  useEffect(() => {
    calcScale();
    const ro = new ResizeObserver(calcScale);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [calcScale, containerRef]);

  return scale;
}

export function DeviceGrid() {
  const devices = useStore((s) => s.devices);
  const disabledSerials = useStore((s) => s.disabledSerials);
  const selectedSerials = useStore((s) => s.selectedSerials);
  const screenshots = useStore((s) => s.screenshots);
  const page = useStore((s) => s.page);
  const pageSize = useStore((s) => s.pageSize);
  const setPage = useStore((s) => s.setPage);
  const fps = useStore((s) => s.fps);
  const overviewMode = useStore((s) => s.overviewMode);
  const setOverviewMode = useStore((s) => s.setOverviewMode);

  const setPageSize = useStore((s) => s.setPageSize);
  const cmds = useAdbCommands();

  const enabledDevices = devices.filter((d) => !disabledSerials.has(d.serial));
  const totalPages = Math.max(1, Math.ceil(enabledDevices.length / pageSize));
  const pageDevices = overviewMode
    ? enabledDevices
    : enabledDevices.slice(page * pageSize, (page + 1) * pageSize);

  const gridRef = useRef<HTMLDivElement>(null);
  const scaleCount = overviewMode ? enabledDevices.length : pageDevices.length;
  const scale = useAutoScale(gridRef, scaleCount);

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
  }, [page, overviewMode, pageDevices.map((d) => `${d.serial}:${d.status}`).join(','), fps, cmds]);

  if (devices.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>📱</div>
        <div className={styles.emptyText}>No devices connected</div>
        <div className={styles.emptyHint}>Add an ADB server in the sidebar to get started</div>
      </div>
    );
  }

  const cardStyle = {
    '--card-width': `${CARD_BASE_WIDTH * scale}px`,
    '--card-height': `${SCREEN_BASE_HEIGHT * scale}px`,
    fontSize: `${scale * 100}%`,
  } as React.CSSProperties;

  return (
    <div className={styles.wrapper}>
      <div
        ref={gridRef}
        className={`${styles.grid} ${styles.gridOverview}`}
      >
        {pageDevices.map((device) => (
          <div key={device.serial} style={cardStyle}>
            <DeviceCard
              device={device}
              screenshot={screenshots[device.serial]}
              selected={selectedSerials.has(device.serial)}
            />
          </div>
        ))}
      </div>
      {devices.length > 0 && (
        <div className={styles.pagination}>
          {!overviewMode && (
            <div className={styles.pageSizeWrap}>
              <span className={styles.pageSizeLabel}>Per page</span>
              <input
                type="number"
                className={styles.pageSizeInput}
                value={pageSize}
                min={1}
                max={999}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (v > 0) setPageSize(v);
                }}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          )}
          {!overviewMode && totalPages > 1 && (
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
          <button
            className={`${styles.overviewBtn} ${overviewMode ? styles.overviewActive : ''}`}
            onClick={() => setOverviewMode(!overviewMode)}
            title={overviewMode ? 'Exit overview' : 'Overview all devices'}
          >
            {overviewMode ? '⊟' : '⊞'}
          </button>
        </div>
      )}
    </div>
  );
}
