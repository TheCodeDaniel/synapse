import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Cache } from '../cache';

describe('Cache (in-memory)', () => {
  it('stores and retrieves values by key', () => {
    const cache = new Cache(60);
    cache.set('a', { hello: 'world' });

    expect(cache.get('a')).toEqual({ hello: 'world' });
    expect(cache.has('a')).toBe(true);
  });

  it('returns null for a missing key', () => {
    const cache = new Cache(60);
    expect(cache.get('missing')).toBeNull();
    expect(cache.has('missing')).toBe(false);
  });

  it('expires entries after the configured TTL', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const cache = new Cache(1); // 1 minute TTL
    cache.set('a', 'value');

    jest.setSystemTime(new Date('2026-01-01T00:00:30Z')); // +30s, still within TTL
    expect(cache.get('a')).toBe('value');

    jest.setSystemTime(new Date('2026-01-01T00:01:30Z')); // +90s, past TTL
    expect(cache.get('a')).toBeNull();

    jest.useRealTimers();
  });

  it('delete removes a key', () => {
    const cache = new Cache(60);
    cache.set('a', 'value');
    cache.delete('a');

    expect(cache.get('a')).toBeNull();
  });

  it('clear removes all keys', () => {
    const cache = new Cache(60);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();

    expect(cache.size).toBe(0);
  });

  it('size reflects the number of stored entries', () => {
    const cache = new Cache(60);
    cache.set('a', 1);
    cache.set('b', 2);

    expect(cache.size).toBe(2);
  });
});

describe('Cache (disk persistence)', () => {
  let diskPath: string;

  beforeEach(() => {
    diskPath = fs.mkdtempSync(path.join(os.tmpdir(), 'di-cache-'));
  });

  afterEach(() => {
    fs.rmSync(diskPath, { recursive: true, force: true });
  });

  it('persists set() values to disk as JSON', () => {
    const cache = new Cache(60, diskPath);
    cache.set('a', { hello: 'world' });

    const filePath = path.join(diskPath, 'a.json');
    expect(fs.existsSync(filePath)).toBe(true);
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(raw.data).toEqual({ hello: 'world' });
  });

  it('loadFromDisk restores non-expired entries into a fresh instance', () => {
    const writer = new Cache(60, diskPath);
    writer.set('a', 'value');

    const reader = new Cache(60, diskPath);
    reader.loadFromDisk();

    expect(reader.get('a')).toBe('value');
  });

  it('loadFromDisk does not resurrect expired entries', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const writer = new Cache(1, diskPath);
    writer.set('a', 'value');

    jest.setSystemTime(new Date('2026-01-01T00:05:00Z')); // well past the 1-minute TTL
    const reader = new Cache(1, diskPath);
    reader.loadFromDisk();

    expect(reader.get('a')).toBeNull();
    jest.useRealTimers();
  });

  it('delete also removes the file on disk', () => {
    const cache = new Cache(60, diskPath);
    cache.set('a', 'value');
    cache.delete('a');

    expect(fs.existsSync(path.join(diskPath, 'a.json'))).toBe(false);
  });

  it('clear also removes files on disk', () => {
    const cache = new Cache(60, diskPath);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();

    expect(fs.readdirSync(diskPath)).toEqual([]);
  });

  it('does not throw when the disk path is unwritable', () => {
    // Point at a path that can never be created (a file, not a directory, as a "parent").
    const blockedPath = path.join(diskPath, 'not-a-dir');
    fs.writeFileSync(blockedPath, 'i am a file, not a directory');
    const cache = new Cache(60, path.join(blockedPath, 'nested'));

    expect(() => cache.set('a', 'value')).not.toThrow();
    // In-memory read still works even though the disk write silently failed.
    expect(cache.get('a')).toBe('value');
  });
});
