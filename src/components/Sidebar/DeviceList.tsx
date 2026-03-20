import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../../store';
import styles from './DeviceList.module.css';

const STATUS_LABEL: Record<string, string> = {
  online: 'Online',
  offline: 'Offline',
  unauthorized: 'Auth?',
  connecting: '...',
};

export function DeviceList() {
  const devices = useStore((s) => s.devices);
  const selectedSerials = useStore((s) => s.selectedSerials);
  const toggleSelect = useStore((s) => s.toggleSelect);
  const selectAll = useStore((s) => s.selectAll);
  const clearSelection = useStore((s) => s.clearSelection);
  const [filter, setFilter] = useState('');

  const selectedCount = selectedSerials.size;
  const keyword = filter.trim().toLowerCase();
  const filtered = keyword
    ? devices.filter((d) =>
        d.serial.toLowerCase().includes(keyword) ||
        d.model.toLowerCase().includes(keyword)
      )
    : devices;

  function launchScrcpy(d: typeof devices[0]) {
    invoke('launch_scrcpy', {
      serial: d.serial,
      serverHost: d.server_host,
      serverPort: d.server_port,
    }).catch(() => {});
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.title}>
          Devices <span className={styles.count}>{devices.length}</span>
        </span>
        <div className={styles.actions}>
          <button className={styles.actionBtn} onClick={selectAll}>All</button>
          <button className={styles.actionBtn} onClick={clearSelection}>None</button>
        </div>
      </div>

      <input
        className={styles.filterInput}
        placeholder="Filter by ID..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {selectedCount > 0 && (
        <div className={styles.selInfo}>{selectedCount} selected</div>
      )}

      <div className={styles.list}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            {devices.length === 0 ? 'No devices detected' : 'No match'}
          </div>
        ) : (
          filtered.map((d) => (
            <div
              key={d.serial}
              className={`${styles.item} ${selectedSerials.has(d.serial) ? styles.selected : ''}`}
              onClick={() => d.status === 'online' && toggleSelect(d.serial)}
            >
              <div className={`${styles.statusDot} ${styles[`status_${d.status}`]}`} />
              <div className={styles.info}>
                <div className={styles.name}>{d.model ? `${d.model} (${d.serial})` : d.serial}</div>
                <div className={styles.meta}>
                  {STATUS_LABEL[d.status]}
                  {d.battery >= 0 && ` · 🔋${d.battery}%`}
                </div>
              </div>
              {d.status === 'online' && (
                <button
                  className={styles.scrcpyBtn}
                  title="Open in scrcpy"
                  onClick={(e) => { e.stopPropagation(); launchScrcpy(d); }}
                >
                  ▶
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
