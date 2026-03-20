import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../../store';
import styles from './FpsSlider.module.css';

export function FpsSlider() {
  const fps = useStore((s) => s.fps);
  const setFps = useStore((s) => s.setFps);
  const devices = useStore((s) => s.devices);
  const selectedSerials = useStore((s) => s.selectedSerials);

  function handleChange(val: number) {
    setFps(val);
    const previewedDevices = devices
      .filter((d) => selectedSerials.has(d.serial) && d.status === 'online');
    for (const d of previewedDevices) {
      invoke('set_fps', { serial: d.serial, fps: val, serverHost: d.server_host, serverPort: d.server_port }).catch(() => {});
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.label}>
        Preview FPS <span className={styles.val}>{fps}</span>
      </div>
      <input
        type="range"
        min={1}
        max={30}
        value={fps}
        className={styles.slider}
        onChange={(e) => handleChange(parseInt(e.target.value))}
      />
    </div>
  );
}
