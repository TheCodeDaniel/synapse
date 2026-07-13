"use strict";
/**
 * Central type exports for @design-intelligence/core
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DesignIntelligenceError = exports.createError = exports.okAsync = exports.err = exports.ok = exports.ErrorCode = void 0;
var results_1 = require("./results");
Object.defineProperty(exports, "ErrorCode", { enumerable: true, get: function () { return results_1.ErrorCode; } });
Object.defineProperty(exports, "ok", { enumerable: true, get: function () { return results_1.ok; } });
Object.defineProperty(exports, "err", { enumerable: true, get: function () { return results_1.err; } });
Object.defineProperty(exports, "okAsync", { enumerable: true, get: function () { return results_1.okAsync; } });
Object.defineProperty(exports, "createError", { enumerable: true, get: function () { return results_1.createError; } });
Object.defineProperty(exports, "DesignIntelligenceError", { enumerable: true, get: function () { return results_1.DesignIntelligenceError; } });
__exportStar(require("./design.graph"), exports);
__exportStar(require("./project.graph"), exports);
__exportStar(require("./planning.engine"), exports);
//# sourceMappingURL=index.js.map