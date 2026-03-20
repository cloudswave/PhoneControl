import { ServerList } from './ServerList';
import { FpsSlider } from './FpsSlider';
import { DeviceList } from './DeviceList';
import styles from './Sidebar.module.css';

export function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>Phone Control</div>
      <div className={styles.divider} />
      <ServerList />
      <div className={styles.divider} />
      <FpsSlider />
      <div className={styles.divider} />
      <DeviceList />
    </aside>
  );
}
