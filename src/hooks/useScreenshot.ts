import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useStore } from '../store';

interface ScreenshotPayload {
  serial: string;
  data: string;
}

export function useScreenshot() {
  const setScreenshot = useStore((s) => s.setScreenshot);
  const setStreamHeartbeat = useStore((s) => s.setStreamHeartbeat);
  const setStreamStatus = useStore((s) => s.setStreamStatus);

  useEffect(() => {
    const unlisten = listen<ScreenshotPayload>('screenshot', (event) => {
      setScreenshot(event.payload.serial, event.payload.data);
    });

    const unlistenHb = listen<{ serial: string; bytes: number }>('stream-heartbeat', (event) => {
      setStreamHeartbeat(event.payload.serial, event.payload.bytes);
    });

    const unlistenStatus = listen<{ serial: string; status: string; error?: string }>('stream-status', (event) => {
      setStreamStatus(event.payload.serial, event.payload.status, event.payload.error);
    });
    return () => {
      unlisten.then((fn) => fn());
      unlistenHb.then((fn) => fn());
      unlistenStatus.then((fn) => fn());
    };
  }, [setScreenshot, setStreamHeartbeat, setStreamStatus]);
}
