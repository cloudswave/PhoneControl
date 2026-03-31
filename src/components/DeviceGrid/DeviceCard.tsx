import React, { useCallback, useRef, useState } from 'react';
import { useStore } from '../../store';
import { useAdbCommands } from '../../hooks/useAdbCommands';
import { getImageLayout } from '../../utils/imageLayout';
import type { Device } from '../../types';
import styles from './DeviceCard.module.css';

interface Props {
  device: Device;
  screenshot: string | undefined;
  selected: boolean;
}

function DeviceCardInner({ device, screenshot, selected }: Props) {
  const toggleSelect = useStore((s) => s.toggleSelect);
  const toggleDisableDevice = useStore((s) => s.toggleDisableDevice);
  const fps = useStore((s) => s.fps);
  const cmds = useAdbCommands();
  const imgRef = useRef<HTMLDivElement>(null);
  const imgElementRef = useRef<HTMLImageElement>(null);
  const [copied, setCopied] = useState(false);

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

  // Tap on screenshot with proper coordinate mapping
  const handleClick = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isOnline) return;
      e.preventDefault();
      e.stopPropagation();

      const rect = e.currentTarget.getBoundingClientRect();
      const containerX = e.clientX - rect.left;
      const containerY = e.clientY - rect.top;

      // Get actual image dimensions and calculate proper coordinates
      let x = containerX;
      let y = containerY;
      let sourceWidth = rect.width;
      let sourceHeight = rect.height;

      // If we have the actual image dimensions, calculate the correct mapping
      if (imgElementRef.current && imgElementRef.current.naturalWidth > 0 && imgElementRef.current.naturalHeight > 0) {
        const layout = getImageLayout(
          rect.width,
          rect.height,
          imgElementRef.current.naturalWidth,
          imgElementRef.current.naturalHeight
        );

        // Convert container coordinates to image coordinates
        x = containerX - layout.offsetX;
        y = containerY - layout.offsetY;
        sourceWidth = layout.displayWidth;
        sourceHeight = layout.displayHeight;

        // Clamp coordinates to image bounds (allow clicks slightly outside due to rounding)
        x = Math.max(0, Math.min(x, sourceWidth));
        y = Math.max(0, Math.min(y, sourceHeight));
      }

      // Round to integers - Rust backend expects u32
      sourceWidth = Math.round(sourceWidth);
      sourceHeight = Math.round(sourceHeight);

      try {
        const results = selected
          ? await cmds.tapDevices(x, y, sourceWidth, sourceHeight)
          : await cmds.tapDevice(device, x, y, sourceWidth, sourceHeight);

        const failed = results.filter(r => !r.success);
        if (failed.length > 0) {
          console.error('Tap failed:', failed);
        }
      } catch (err) {
        console.error('Tap error:', err);
      }
    },
    [isOnline, selected, device, cmds]
  );

  // Swipe tracking
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isOnline) return;
    e.preventDefault();
    e.stopPropagation();
    swipeStart.current = { x: e.clientX, y: e.clientY };
  }, [isOnline]);

  const handleMouseUp = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      if (!swipeStart.current || !isOnline) return;
      e.preventDefault();
      e.stopPropagation();

      const dx = e.clientX - swipeStart.current.x;
      const dy = e.clientY - swipeStart.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 10) {
        const rect = e.currentTarget.getBoundingClientRect();
        const containerX1 = swipeStart.current.x - rect.left;
        const containerY1 = swipeStart.current.y - rect.top;
        const containerX2 = e.clientX - rect.left;
        const containerY2 = e.clientY - rect.top;

        let x1 = containerX1;
        let y1 = containerY1;
        let x2 = containerX2;
        let y2 = containerY2;
        let sourceWidth = rect.width;
        let sourceHeight = rect.height;

        // If we have the actual image dimensions, calculate the correct mapping
        if (imgElementRef.current && imgElementRef.current.naturalWidth > 0 && imgElementRef.current.naturalHeight > 0) {
          const layout = getImageLayout(
            rect.width,
            rect.height,
            imgElementRef.current.naturalWidth,
            imgElementRef.current.naturalHeight
          );

          // Convert container coordinates to image coordinates
          x1 = containerX1 - layout.offsetX;
          y1 = containerY1 - layout.offsetY;
          x2 = containerX2 - layout.offsetX;
          y2 = containerY2 - layout.offsetY;
          sourceWidth = layout.displayWidth;
          sourceHeight = layout.displayHeight;

          // Clamp coordinates to image bounds
          x1 = Math.max(0, Math.min(x1, sourceWidth));
          y1 = Math.max(0, Math.min(y1, sourceHeight));
          x2 = Math.max(0, Math.min(x2, sourceWidth));
          y2 = Math.max(0, Math.min(y2, sourceHeight));
        }

        // Round to integers - Rust backend expects u32
        sourceWidth = Math.round(sourceWidth);
        sourceHeight = Math.round(sourceHeight);

        try {
          const results = selected
            ? await cmds.swipeDevices(x1, y1, x2, y2, 300, sourceWidth, sourceHeight)
            : await cmds.swipeDevice(device, x1, y1, x2, y2, 300, sourceWidth, sourceHeight);

          // Log success/failure for debugging
          const failed = results.filter(r => !r.success);
          if (failed.length > 0) {
            console.error('Swipe command failed:', failed);
          }
        } catch (err) {
          console.error('Swipe command error:', err);
        }
      }
      swipeStart.current = null;
    },
    [isOnline, selected, device, cmds]
  );

  // Copy device ID to clipboard
  const handleCopySerial = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(device.serial);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [device.serial]);

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
        className={`${styles.screen} ${isOnline ? styles.screenActive : ''}`}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onDragStart={(e) => e.preventDefault()}
      >
        {screenshot ? (
          <img
            ref={imgElementRef}
            src={screenshot}
            className={styles.img}
            alt="screen"
            draggable={false}
            style={{ pointerEvents: 'none' }}
          />
        ) : (
          <div className={styles.placeholder}>
            {isOnline ? 'Loading...' : device.status}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span
          className={styles.serial}
          onClick={handleCopySerial}
          title={copied ? 'Copied!' : 'Click to copy'}
          style={{ cursor: 'pointer' }}
        >
          {copied ? '✓ Copied' : device.serial}
        </span>
        <div className={styles.footerActions}>
          <button
            className={styles.disableBtn}
            onClick={(e) => { e.stopPropagation(); toggleDisableDevice(device.serial); }}
            title="Disable device"
          >
            ✕
          </button>
          {isOnline && (
            <button
              className={styles.scrcpyBtn}
              onClick={(e) => { e.stopPropagation(); cmds.launchScrcpy(device.serial, device.server_host, device.server_port); }}
              title="Open in scrcpy"
            >
              ▶
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const DeviceCard = React.memo(DeviceCardInner);
