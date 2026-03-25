import { create } from 'zustand';
import type { AdbServer, Device } from '../types';

const PAGE_SIZE = 14;

interface AppStore {
  // Servers
  servers: AdbServer[];
  setServers: (servers: AdbServer[]) => void;

  // Devices
  devices: Device[];
  setDevices: (devices: Device[]) => void;

  // Disabled devices
  disabledSerials: Set<string>;
  toggleDisableDevice: (serial: string) => void;

  // Selection
  selectedSerials: Set<string>;
  toggleSelect: (serial: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  // Screenshots: serial -> dataURL
  screenshots: Record<string, string>;
  setScreenshot: (serial: string, data: string) => void;

  // FPS
  fps: number;
  setFps: (fps: number) => void;

  // Pagination
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

export const useStore = create<AppStore>((set) => ({
  servers: [],
  setServers: (servers) => set({ servers }),

  devices: [],
  setDevices: (devices) => set((s) => {
    const totalPages = Math.max(1, Math.ceil(devices.length / s.pageSize));
    return { devices, page: Math.min(s.page, totalPages - 1) };
  }),

  disabledSerials: new Set(),
  toggleDisableDevice: (serial) =>
    set((s) => {
      const next = new Set(s.disabledSerials);
      if (next.has(serial)) next.delete(serial);
      else next.add(serial);
      return { disabledSerials: next };
    }),

  selectedSerials: new Set(),
  toggleSelect: (serial) =>
    set((s) => {
      const next = new Set(s.selectedSerials);
      if (next.has(serial)) next.delete(serial);
      else next.add(serial);
      return { selectedSerials: next };
    }),
  selectAll: () =>
    set((s) => ({
      selectedSerials: new Set(
        s.devices.filter((d) => d.status === 'online').map((d) => d.serial)
      ),
    })),
  clearSelection: () => set({ selectedSerials: new Set() }),

  screenshots: {},
  setScreenshot: (serial, data) =>
    set((s) => ({ screenshots: { ...s.screenshots, [serial]: data } })),

  fps: 2,
  setFps: (fps) => set({ fps }),

  page: 0,
  pageSize: PAGE_SIZE,
  setPage: (page) => set({ page }),
  setPageSize: (size) => set((s) => {
    const totalPages = Math.max(1, Math.ceil(s.devices.length / size));
    return { pageSize: size, page: Math.min(s.page, totalPages - 1) };
  }),
}));
