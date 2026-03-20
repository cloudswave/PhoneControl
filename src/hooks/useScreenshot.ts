import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useStore } from '../store';

interface ScreenshotPayload {
  serial: string;
  data: string;
}

export function useScreenshot() {
  const setScreenshot = useStore((s) => s.setScreenshot);

  useEffect(() => {
    const unlisten = listen<ScreenshotPayload>('screenshot', (event) => {
      setScreenshot(event.payload.serial, event.payload.data);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setScreenshot]);
}
