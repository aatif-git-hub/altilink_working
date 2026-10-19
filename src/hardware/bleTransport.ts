import { BleClient } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import { SERVICE, WRITE, NOTIFY } from './protocol';
export interface BandTransport {
  connect(onData: (data: DataView) => void, onDisconnect: () => void): Promise<string>;
  write(bytes: Uint8Array): Promise<void>;
  disconnect(): Promise<void>;
}
export class BleTransport implements BandTransport {
  private deviceId: string | null = null;
  private generation = 0;
  private queue: Promise<void> = Promise.resolve();
  async connect(onData: (data: DataView) => void, onDisconnect: () => void) {
    if (!Capacitor.isNativePlatform()) {
      if (!window.isSecureContext) throw Error('Bluetooth requires HTTPS or localhost. A phone opening an HTTP LAN address cannot connect.');
      if (!('bluetooth' in navigator)) throw Error('Use Chrome on Android or Mac for Bluetooth, or the Android app. This browser does not support Web Bluetooth.');
    }
    await BleClient.initialize();
    const device = await BleClient.requestDevice({ services: [SERVICE] });
    const generation = ++this.generation;
    this.deviceId = device.deviceId;
    try {
      await BleClient.connect(device.deviceId, () => {
        if (generation !== this.generation) return;
        this.deviceId = null; this.generation++; onDisconnect();
      });
      await BleClient.startNotifications(device.deviceId, SERVICE, NOTIFY, data => {
        if (generation === this.generation && this.deviceId === device.deviceId) onData(data);
      });
      if (generation !== this.generation) throw Error('Band disconnected during setup');
      return device.name || 'AltiLink band';
    } catch (e) { await this.disconnect(); throw e; }
  }
  write(bytes: Uint8Array) {
    const id = this.deviceId;
    const generation = this.generation;
    const task = this.queue.catch(() => {}).then(async () => {
      if (!id || generation !== this.generation) throw Error('Band disconnected');
      for (let offset = 0; offset < bytes.length; offset += 20) {
        if (generation !== this.generation) throw Error('Band disconnected during command');
        const chunk = bytes.slice(offset, offset + 20);
        await BleClient.write(id, SERVICE, WRITE, new DataView(chunk.buffer));
      }
    });
    this.queue = task;
    return task;
  }
  async disconnect() {
    const id = this.deviceId;
    this.deviceId = null; this.generation++;
    if (id) await BleClient.disconnect(id).catch(() => {});
  }
}
