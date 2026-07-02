"use strict";
/**
 * In-memory caching layer with filesystem fallback.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cache = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class Cache {
    store;
    ttlMs;
    diskPath;
    constructor(ttlMinutes = 60, diskPath) {
        this.store = new Map();
        this.ttlMs = ttlMinutes * 60 * 1000;
        this.diskPath = diskPath;
    }
    get(key) {
        const entry = this.store.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return entry.data;
    }
    set(key, data) {
        const entry = {
            data,
            expiresAt: Date.now() + this.ttlMs,
        };
        this.store.set(key, entry);
        if (this.diskPath) {
            try {
                fs.mkdirSync(this.diskPath, { recursive: true });
                const filePath = path.join(this.diskPath, `${key}.json`);
                fs.writeFileSync(filePath, JSON.stringify({ data, expiresAt: entry.expiresAt }));
            }
            catch {
                // Silently fail disk writes
            }
        }
    }
    has(key) {
        return this.get(key) !== null;
    }
    delete(key) {
        this.store.delete(key);
        if (this.diskPath) {
            try {
                const filePath = path.join(this.diskPath, `${key}.json`);
                fs.unlinkSync(filePath);
            }
            catch {
                // Silently fail disk deletes
            }
        }
    }
    clear() {
        this.store.clear();
        if (this.diskPath) {
            try {
                const dir = fs.readdirSync(this.diskPath);
                for (const file of dir) {
                    fs.unlinkSync(path.join(this.diskPath, file));
                }
            }
            catch {
                // Silently fail disk clear
            }
        }
    }
    loadFromDisk() {
        if (!this.diskPath || !fs.existsSync(this.diskPath))
            return;
        try {
            const files = fs.readdirSync(this.diskPath);
            for (const file of files) {
                if (!file.endsWith('.json'))
                    continue;
                const filePath = path.join(this.diskPath, file);
                const raw = fs.readFileSync(filePath, 'utf-8');
                const entry = JSON.parse(raw);
                if (Date.now() <= entry.expiresAt) {
                    this.store.set(file.replace('.json', ''), entry);
                }
            }
        }
        catch {
            // Silently fail disk reads
        }
    }
    saveToDisk() {
        if (!this.diskPath)
            return;
        try {
            fs.mkdirSync(this.diskPath, { recursive: true });
            for (const [key, entry] of this.store.entries()) {
                const filePath = path.join(this.diskPath, `${key}.json`);
                fs.writeFileSync(filePath, JSON.stringify(entry));
            }
        }
        catch {
            // Silently fail disk writes
        }
    }
    get size() {
        return this.store.size;
    }
}
exports.Cache = Cache;
//# sourceMappingURL=cache.js.map