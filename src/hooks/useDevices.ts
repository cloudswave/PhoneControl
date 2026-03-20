import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useStore } from '../store';
import type { Device } from '../types';

export function useDevices() {
  const setDevices = useStore((s) => s.setDevices);

  useEffect(() => {
    const unlisten = listen<Device[]>('devices-updated', (event) => {
      setDevices(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setDevices]);
}
