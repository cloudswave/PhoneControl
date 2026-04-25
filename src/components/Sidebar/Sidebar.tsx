
import { ServerList } from "./ServerList";
import { FpsSlider } from "./FpsSlider";
import { DeviceList } from "./DeviceList";
import styles from "./Sidebar.module.css";
import { useStore } from '../../store';
import { ServerList } from './ServerList';
import { FpsSlider } from './FpsSlider';
import { DeviceList } from './DeviceList';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const toggle = useStore((s) => s.toggleSidebar);

  return (

    <aside className={styles.sidebar}>
      <div className={styles.logo}>安卓群控</div>
      <div className={styles.divider} />
      <ServerList />
      <div className={styles.divider} />
      <FpsSlider />
      <div className={styles.divider} />
      <DeviceList />
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      {collapsed ? (
        <button className={styles.toggleBtn} onClick={toggle} title="Expand sidebar">
          »
        </button>
      ) : (
        <>
          <div className={styles.logoRow}>
            <div className={styles.logo}>Phone Control</div>
            <button className={styles.toggleBtn} onClick={toggle} title="Collapse sidebar">
              «
            </button>
          </div>
          <div className={styles.divider} />
          <ServerList />
          <div className={styles.divider} />
          <FpsSlider />
          <div className={styles.divider} />
          <DeviceList />
        </>
      )}
    </aside>
  );
}
