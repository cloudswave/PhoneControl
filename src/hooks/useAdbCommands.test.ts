import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAdbCommands } from './useAdbCommands';
import { useStore } from '../store';
import type { Device } from '../types';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const { invoke } = await import('@tauri-apps/api/core');

describe('useAdbCommands', () => {
  const mockDevice: Device = {
    serial: 'test-device-1',
    status: 'online',
    model: 'Test Phone',
    battery: 80,
    screen_width: 1080,
    screen_height: 1920,
    server_host: '127.0.0.1',
    server_port: 5037,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      devices: [mockDevice],
      selectedSerials: new Set(),
    });
  });

  describe('tapDevice', () => {
    it('should invoke tap_devices with single device', async () => {
      const cmds = useAdbCommands();
      await cmds.tapDevice(mockDevice, 100, 200, 300, 600);

      expect(invoke).toHaveBeenCalledWith('tap_devices', {
        serials: [{
          serial: 'test-device-1',
          width: 1080,
          height: 1920,
          server_host: '127.0.0.1',
          server_port: 5037,
        }],
        x: 100,
        y: 200,
        sourceWidth: 300,
        sourceHeight: 600,
      });
    });
  });

  describe('swipeDevice', () => {
    it('should invoke swipe_devices with single device', async () => {
      const cmds = useAdbCommands();
      await cmds.swipeDevice(mockDevice, 100, 200, 150, 400, 300, 300, 600);

      expect(invoke).toHaveBeenCalledWith('swipe_devices', {
        serials: [{
          serial: 'test-device-1',
          width: 1080,
          height: 1920,
          server_host: '127.0.0.1',
          server_port: 5037,
        }],
        x1: 100,
        y1: 200,
        x2: 150,
        y2: 400,
        durationMs: 300,
        sourceWidth: 300,
        sourceHeight: 600,
      });
    });
  });

  describe('tapDevices', () => {
    it('should invoke tap_devices with all selected devices', async () => {
      useStore.setState({
        devices: [mockDevice],
        selectedSerials: new Set(['test-device-1']),
      });

      const cmds = useAdbCommands();
      await cmds.tapDevices(100, 200, 300, 600);

      expect(invoke).toHaveBeenCalledWith('tap_devices', {
        serials: [{
          serial: 'test-device-1',
          width: 1080,
          height: 1920,
          server_host: '127.0.0.1',
          server_port: 5037,
        }],
        x: 100,
        y: 200,
        sourceWidth: 300,
        sourceHeight: 600,
      });
    });

    it('should not include offline devices', async () => {
      const offlineDevice: Device = { ...mockDevice, serial: 'offline-device', status: 'offline' };
      useStore.setState({
        devices: [mockDevice, offlineDevice],
        selectedSerials: new Set(['test-device-1', 'offline-device']),
      });

      const cmds = useAdbCommands();
      await cmds.tapDevices(100, 200, 300, 600);

      const call = (invoke as any).mock.calls[0][1];
      expect(call.serials).toHaveLength(1);
      expect(call.serials[0].serial).toBe('test-device-1');
    });
  });
});
