import { BandTransport } from './bleTransport';
import { BoardEvent, LineDecoder, parseEvent } from './protocol';
export class BandClient {
  private decoder = new LineDecoder();
  private pending = new Map<string, { resolve: (e: Extract<BoardEvent, { event: 'result' }>) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private counter = 0;
  private connected = false;
  constructor(private transport: BandTransport, private onEvent: (event: BoardEvent) => void, private onDisconnect: () => void, private onError: (message: string) => void) {}
  async connect() {
    this.decoder.reset();
    const name = await this.transport.connect(data => {
      try {
        for (const line of this.decoder.push(data)) {
          try {
            const event = parseEvent(line);
            if (event.event === 'result') {
              const pending = this.pending.get(event.id);
              if (pending) {
                clearTimeout(pending.timer); this.pending.delete(event.id);
                event.ok ? pending.resolve(event) : pending.reject(Error(event.message));
              }
            }
            this.onEvent(event);
          } catch (e) { this.onError((e as Error).message); }
        }
      } catch (e) { this.onError((e as Error).message); }
    }, () => { this.clear(); this.onDisconnect(); });
    this.connected = true;
    return name;
  }
  command(command: string, data: Record<string, unknown> = {}) {
    if (!this.connected) return Promise.reject(Error('Connect a band first'));
    const id = `c${Date.now().toString(36)}_${++this.counter}`;
    const bytes = new TextEncoder().encode(JSON.stringify({ ...data, v: 1, id, command }) + '\n');
    if (bytes.length > 512) return Promise.reject(Error('Command too large'));
    return new Promise<Extract<BoardEvent, { event: 'result' }>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(Error('No response from the band. Delivery is unknown; check the band before retrying.'));
      }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      this.transport.write(bytes).catch(e => {
        const pending = this.pending.get(id);
        if (!pending) return;
        clearTimeout(timer); this.pending.delete(id); reject(e);
      });
    });
  }
  private clear() {
    this.connected = false; this.decoder.reset();
    this.pending.forEach(p => { clearTimeout(p.timer); p.reject(Error('Band disconnected; command delivery is unknown')); });
    this.pending.clear();
  }
  async disconnect() { this.clear(); await this.transport.disconnect(); }
}
