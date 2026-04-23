const registry = new Map<string, HTMLCanvasElement>();

export function registerCanvas(serial: string, canvas: HTMLCanvasElement): void {
  registry.set(serial, canvas);
}

export function unregisterCanvas(serial: string): void {
  registry.delete(serial);
}

export function getCanvas(serial: string): HTMLCanvasElement | undefined {
  return registry.get(serial);
}
