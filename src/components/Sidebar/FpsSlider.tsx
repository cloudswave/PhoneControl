import { useStore } from '../../store';
import styles from './FpsSlider.module.css';

export function FpsSlider() {
  const fps = useStore((s) => s.fps);
  const setFps = useStore((s) => s.setFps);

  function handleChange(val: number) {
    setFps(val);
    // Stream rendering throttle is implemented client-side; no backend call here.
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.label}>
        Render FPS <span className={styles.val}>{fps}</span>
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
