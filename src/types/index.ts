export interface AdbServer {
  id: string;
  host: string;
  port: number;
  enabled: boolean;
}

export type DeviceStatus = 'online' | 'offline' | 'unauthorized' | 'connecting';

export interface Device {
  serial: string;
  status: DeviceStatus;
  model: string;
  battery: number;
  screen_width: number;
  screen_height: number;
  server_host: string;
  server_port: number;
}

export interface CommandResult {
  serial: string;
  success: boolean;
  message: string;
}

export interface DeviceResolution {
  serial: string;
  width: number;
  height: number;
  server_host: string;
  server_port: number;
}

export interface AppConfig {
  servers: AdbServer[];
}

export interface ScanResult {
  ip: string;
  port: number;
  success: boolean;
  message: string;
}
