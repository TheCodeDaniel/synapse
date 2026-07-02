/**
 * In-memory caching layer with filesystem fallback.
 */

import * as fs from 'fs';
import * as path from 'path';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class Cache {
  private store: Map<string, CacheEntry<unknown>>;
  private ttlMs: number;
  private diskPath?: string;

  constructor(ttlMinutes = 60, diskPath?: string) {
    this.store = new Map();
    this.ttlMs = ttlMinutes * 60 * 1000;
    this.diskPath = diskPath;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    const entry: CacheEntry<T> = {
      data,
      expiresAt: Date.now() + this.ttlMs,
    };
    this.store.set(key, entry as CacheEntry<unknown>);

    if (this.diskPath) {
      try {
        fs.mkdirSync(this.diskPath, { recursive: true });
        const filePath = path.join(this.diskPath, `${key}.json`);
        fs.writeFileSync(filePath, JSON.stringify({ data, expiresAt: entry.expiresAt }));
      } catch {
        // Silently fail disk writes
      }
    }
  }

  has(key: string): boolean {
    return this.get<unknown>(key) !== null;
  }

  delete(key: string): void {
    this.store.delete(key);
    if (this.diskPath) {
      try {
        const filePath = path.join(this.diskPath, `${key}.json`);
        fs.unlinkSync(filePath);
      } catch {
        // Silently fail disk deletes
      }
    }
  }

  clear(): void {
    this.store.clear();
    if (this.diskPath) {
      try {
        const dir = fs.readdirSync(this.diskPath);
        for (const file of dir) {
          fs.unlinkSync(path.join(this.diskPath, file));
        }
      } catch {
        // Silently fail disk clear
      }
    }
  }

  loadFromDisk(): void {
    if (!this.diskPath || !fs.existsSync(this.diskPath)) return;

    try {
      const files = fs.readdirSync(this.diskPath);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const filePath = path.join(this.diskPath, file);
        const raw = fs.readFileSync(filePath, 'utf-8');
        const entry: CacheEntry<unknown> = JSON.parse(raw);

        if (Date.now() <= entry.expiresAt) {
          this.store.set(file.replace('.json', ''), entry);
        }
      }
    } catch {
      // Silently fail disk reads
    }
  }

  saveToDisk(): void {
    if (!this.diskPath) return;

    try {
      fs.mkdirSync(this.diskPath, { recursive: true });
      for (const [key, entry] of this.store.entries()) {
        const filePath = path.join(this.diskPath, `${key}.json`);
        fs.writeFileSync(filePath, JSON.stringify(entry));
      }
    } catch {
      // Silently fail disk writes
    }
  }

  get size(): number {
    return this.store.size;
  }
}