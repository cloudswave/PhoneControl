import React, { useCallback, useRef } from 'react';
import { useStore } from '../../store';
import { useAdbCommands } from '../../hooks/useAdbCommands';
import type { Device } from '../../types';
import styles from './DeviceCard.module.css';

interface Props {
  device: Device;
  screenshot: string | undefined;
  selected: boolean;
}

function DeviceCardInner({ device, screenshot, selected }: Props) {
  const toggleSelect = useStore((s) => s.toggleSelect);
  const fps = useStore((s) => s.fps);
  const cmds = useAdbCommands();
  const imgRef = useRef<HTMLDivElement>(null);

  const isOnline = device.status === 'online';

  // Start/stop preview on selection change
  const handleSelect = useCallback(() => {
    if (!isOnline) return;
    const wasSelected = selected;
    toggleSelect(device.serial);
    if (!wasSelected) {
      cmds.startPreview(device.serial, fps, device.server_host, device.server_port);
    } else {
      cmds.stopPreview(device.serial);
    }
  }, [device.serial, device.server_host, device.server_port, selected, isOnline, fps, cmds, toggleSelect]);

  // Tap on screenshot
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isOnline || !selected) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      cmds.tapDevices(x, y, rect.width, rect.height);
    },
    [isOnline, selected, cmds]
  );

  // Swipe tracking
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isOnline || !selected) return;
    swipeStart.current = { x: e.clientX, y: e.clientY };
  }, [isOnline, selected]);

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!swipeStart.current || !isOnline || !selected) return;
      const dx = e.clientX - swipeStart.current.x;
      const dy = e.clientY - swipeStart.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 10) {
        const rect = e.currentTarget.getBoundingClientRect();
        cmds.swipeDevices(
          swipeStart.current.x - rect.left,
          swipeStart.current.y - rect.top,
          e.clientX - rect.left,
          e.clientY - rect.top,
          300,
          rect.width,
          rect.height
        );
      }
      swipeStart.current = null;
    },
    [isOnline, selected, cmds]
  );

  const statusClass = styles[`status_${device.status}`] ?? styles.status_offline;

  return (
    <div className={`${styles.card} ${selected ? styles.cardSelected : ''}`}>
      {/* Header */}
      <div className={styles.header} onClick={handleSelect}>
        <div className={`${styles.statusDot} ${statusClass}`} />
        <span className={styles.name}>{device.model || device.serial}</span>
        {device.battery >= 0 && (
          <span className={styles.battery}>{device.battery}%</span>
        )}
      </div>

      {/* Screen */}
      <div
        ref={imgRef}
        className={`${styles.screen} ${selected && isOnline ? styles.screenActive : ''}`}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        {screenshot ? (
          <img src={screenshot} className={styles.img} alt="screen" draggable={false} />
        ) : (
          <div className={styles.placeholder}>
            {isOnline ? (selected ? 'Loading...' : 'Click to select') : device.status}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span className={styles.serial}>{device.serial}</span>
        {isOnline && (
          <button
            className={styles.scrcpyBtn}
            onClick={(e) => { e.stopPropagation(); cmds.launchScrcpy(device.serial, device.server_host, device.server_port); }}
            title="Open in scrcpy"
          >
            ▶ scrcpy
          </button>
        )}
      </div>
    </div>
  );
}

export const DeviceCard = React.memo(DeviceCardInner);
