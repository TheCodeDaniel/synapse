/**
 * In-memory caching layer with filesystem fallback.
 */
export declare class Cache {
    private store;
    private ttlMs;
    private diskPath?;
    constructor(ttlMinutes?: number, diskPath?: string);
    get<T>(key: string): T | null;
    set<T>(key: string, data: T): void;
    has(key: string): boolean;
    delete(key: string): void;
    clear(): void;
    loadFromDisk(): void;
    saveToDisk(): void;
    get size(): number;
}
//# sourceMappingURL=cache.d.ts.map