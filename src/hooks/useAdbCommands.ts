import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../store';
import type { CommandResult, DeviceResolution, Device } from '../types';

export function useAdbCommands() {
  return {
    async tapDevices(x: number, y: number, sourceWidth: number, sourceHeight: number): Promise<CommandResult[]> {
      const { devices, selectedSerials, streamFrames } = useStore.getState();
      const onlineDevices = devices
        .filter((d) => selectedSerials.has(d.serial) && d.status === 'online');

      const results: CommandResult[] = [];
      const adbFallback: DeviceResolution[] = [];

      for (const d of onlineDevices) {
        if (streamFrames[d.serial]) {
          try {
            const r = await invoke<CommandResult>('scrcpy_tap', {
              serial: d.serial, x, y, sourceWidth, sourceHeight,
              targetWidth: d.screen_width, targetHeight: d.screen_height,
              serverHost: d.server_host, serverPort: d.server_port,
            });
            results.push(r);
            continue;
          } catch (e) { console.warn('[scrcpy_tap] failed, ADB fallback:', d.serial, e); }
        }
        adbFallback.push({ serial: d.serial, width: d.screen_width, height: d.screen_height, server_host: d.server_host, server_port: d.server_port });
      }

      if (adbFallback.length > 0) {
        const batch = await invoke<CommandResult[]>('tap_devices', { serials: adbFallback, x, y, sourceWidth, sourceHeight });
        results.push(...batch);
      }
      return results;
    },

    async tapDevice(device: Device, x: number, y: number, sourceWidth: number, sourceHeight: number): Promise<CommandResult[]> {
      const { streamFrames } = useStore.getState();
      if (streamFrames[device.serial]) {
        try {
          const r = await invoke<CommandResult>('scrcpy_tap', {
            serial: device.serial, x, y, sourceWidth, sourceHeight,
            targetWidth: device.screen_width, targetHeight: device.screen_height,
            serverHost: device.server_host, serverPort: device.server_port,
          });
          return [r];
        } catch (e) { console.warn('[scrcpy_tap] device failed, ADB fallback:', device.serial, e); }
      }
      const serials: DeviceResolution[] = [{
        serial: device.serial,
        width: device.screen_width,
        height: device.screen_height,
        server_host: device.server_host,
        server_port: device.server_port,
      }];
      return invoke<CommandResult[]>('tap_devices', { serials, x, y, sourceWidth, sourceHeight });
    },

    async swipeDevices(
      x1: number, y1: number, x2: number, y2: number,
      durationMs: number, sourceWidth: number, sourceHeight: number
    ): Promise<CommandResult[]> {
      const { devices, selectedSerials, streamFrames } = useStore.getState();
      const onlineDevices = devices
        .filter((d) => selectedSerials.has(d.serial) && d.status === 'online');

      const results: CommandResult[] = [];
      const adbFallback: DeviceResolution[] = [];

      for (const d of onlineDevices) {
        if (streamFrames[d.serial]) {
          try {
            const r = await invoke<CommandResult>('scrcpy_swipe', {
              serial: d.serial, x1, y1, x2, y2, durationMs,
              sourceWidth, sourceHeight,
              targetWidth: d.screen_width, targetHeight: d.screen_height,
              serverHost: d.server_host, serverPort: d.server_port,
            });
            results.push(r);
            continue;
          } catch (e) { console.warn('[scrcpy_swipe] failed, ADB fallback:', d.serial, e); }
        }
        adbFallback.push({ serial: d.serial, width: d.screen_width, height: d.screen_height, server_host: d.server_host, server_port: d.server_port });
      }

      if (adbFallback.length > 0) {
        const batch = await invoke<CommandResult[]>('swipe_devices', { serials: adbFallback, x1, y1, x2, y2, durationMs, sourceWidth, sourceHeight });
        results.push(...batch);
      }
      return results;
    },

    async swipeDevice(
      device: Device,
      x1: number, y1: number, x2: number, y2: number,
      durationMs: number, sourceWidth: number, sourceHeight: number
    ): Promise<CommandResult[]> {
      const { streamFrames } = useStore.getState();
      if (streamFrames[device.serial]) {
        try {
          const r = await invoke<CommandResult>('scrcpy_swipe', {
            serial: device.serial, x1, y1, x2, y2, durationMs,
            sourceWidth, sourceHeight,
            targetWidth: device.screen_width, targetHeight: device.screen_height,
            serverHost: device.server_host, serverPort: device.server_port,
          });
          return [r];
        } catch (e) { console.warn('[scrcpy_swipe] device failed, ADB fallback:', device.serial, e); }
      }
      const serials: DeviceResolution[] = [{
        serial: device.serial,
        width: device.screen_width,
        height: device.screen_height,
        server_host: device.server_host,
        server_port: device.server_port,
      }];
      return invoke<CommandResult[]>('swipe_devices', { serials, x1, y1, x2, y2, durationMs, sourceWidth, sourceHeight });
    },

    async sendText(text: string): Promise<CommandResult[]> {
      const { devices, selectedSerials } = useStore.getState();
      const serials: DeviceResolution[] = devices
        .filter((d) => selectedSerials.has(d.serial) && d.status === 'online')
        .map((d) => ({
          serial: d.serial,
          width: d.screen_width,
          height: d.screen_height,
          server_host: d.server_host,
          server_port: d.server_port,
        }));
      return invoke<CommandResult[]>('send_text_devices', { serials, text });
    },

    async keyevent(keycode: number): Promise<CommandResult[]> {
      const { devices, selectedSerials } = useStore.getState();
      const serials: DeviceResolution[] = devices
        .filter((d) => selectedSerials.has(d.serial) && d.status === 'online')
        .map((d) => ({
          serial: d.serial,
          width: d.screen_width,
          height: d.screen_height,
          server_host: d.server_host,
          server_port: d.server_port,
        }));
      return invoke<CommandResult[]>('keyevent_devices', { serials, keycode });
    },

    startPreview(serial: string, fps: number, serverHost: string, serverPort: number) {
      return invoke<void>('start_preview', { serial, fps, serverHost, serverPort });
    },

    stopPreview(serial: string) {
      return invoke<void>('stop_preview', { serial });
    },

    setFps(serial: string, fps: number, serverHost: string, serverPort: number) {
      return invoke<void>('set_fps', { serial, fps, serverHost, serverPort });
    },

    startStream(
      serial: string,
      serverHost: string,
      serverPort: number,
      options?: { max_size: number; max_fps: number; bit_rate: number }
    ) {
      return invoke<void>('start_stream', {
        serial,
        serverHost,
        serverPort,
        options: options ?? { max_size: 720, max_fps: 30, bit_rate: 4_000_000 },
      });
    },

    stopStream(serial: string) {
      return invoke<void>('stop_stream', { serial });
    },

    launchScrcpy(serial: string, serverHost: string, serverPort: number) {
      return invoke<void>('launch_scrcpy', { serial, serverHost, serverPort });
    },

    async runShell(cmd: string): Promise<CommandResult[]> {
      const { devices, selectedSerials } = useStore.getState();
      const serials: DeviceResolution[] = devices
        .filter((d) => selectedSerials.has(d.serial) && d.status === 'online')
        .map((d) => ({
          serial: d.serial,
          width: d.screen_width,
          height: d.screen_height,
          server_host: d.server_host,
          server_port: d.server_port,
        }));
      return invoke<CommandResult[]>('run_shell_devices', { serials, cmd });
    },

    async wakeUpDevices(serials: DeviceResolution[]): Promise<CommandResult[]> {
      return invoke<CommandResult[]>('wake_up_devices', { serials });
    },
  };
}
