type Entry<T> = { value: T; expiresAt: number };

/** In-memory TTL cache with LRU eviction when full. */
export class BoundedTTLCache<T> {
  private map = new Map<string, Entry<T>>();

  constructor(private readonly maxSize: number) {}

  get(key: string): T | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    if (this.map.has(key)) this.map.delete(key);
    while (this.map.size >= this.maxSize) {
      const oldest = this.map.keys().next().value;
      if (oldest) this.map.delete(oldest);
      else break;
    }
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}
