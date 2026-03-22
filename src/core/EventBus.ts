export interface GameEvents {
  'input:targetX':     { worldX: number };
  'input:jump':        Record<string, never>;
  'input:slide':       Record<string, never>;

  'player:jump':       Record<string, never>;
  'player:slide':      Record<string, never>;
  'player:died':       Record<string, never>;
  'player:finished':   Record<string, never>;

  'obstacle:hit':      Record<string, never>;
  'coin:collected':    { value: number; total: number };
  'gate:entered':      { positive: boolean };
  'gate:effect':       { op: '+' | '-' | '*' | '/'; value: number; positive: boolean };

  'game:started':      Record<string, never>;
  'game:over':         { score: number; coins: number };
  'game:won':          { score: number; coins: number };
  'game:speed_changed': { speed: number };

  'ui:mute_changed':   { muted: boolean };
}

type EventKey = keyof GameEvents;
type Listener<K extends EventKey> = (payload: GameEvents[K]) => void;
type ListenerMap = { [K in EventKey]?: Set<Listener<K>> };

export class EventBus {
  private readonly listeners: ListenerMap = {};

  on<K extends EventKey>(event: K, listener: Listener<K>): void {
    if (!this.listeners[event]) {
      (this.listeners[event] as unknown as Set<Listener<K>>) = new Set();
    }
    (this.listeners[event] as Set<Listener<K>>).add(listener);
  }

  off<K extends EventKey>(event: K, listener: Listener<K>): void {
    (this.listeners[event] as Set<Listener<K>> | undefined)?.delete(listener);
  }

  emit<K extends EventKey>(event: K, payload: GameEvents[K]): void {
    // console.log(`emitted: ${event}`);
    (this.listeners[event] as Set<Listener<K>> | undefined)?.forEach(fn => fn(payload));
  }

  clear(): void {
    for (const key in this.listeners) {
      delete this.listeners[key as EventKey];
    }
  }
}