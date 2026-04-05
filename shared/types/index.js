"use strict";
// ============================================
// V2 Resort - Shared TypeScript Types
// ============================================
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
// ----- Domain Module Re-exports -----
__exportStar(require("./giftcards"), exports);
__exportStar(require("./coupons"), exports);
__exportStar(require("./housekeeping"), exports);
__exportStar(require("./loyalty"), exports);
__exportStar(require("./inventory"), exports);
__exportStar(require("./staff"), exports);
__exportStar(require("./channels"), exports);
__exportStar(require("./reviews"), exports);
__exportStar(require("./gdpr"), exports);
__exportStar(require("./marketing"), exports);
__exportStar(require("./messaging"), exports);
__exportStar(require("./modules"), exports);
__exportStar(require("./property"), exports);
__exportStar(require("./kiosk"), exports);
__exportStar(require("./finance"), exports);
__exportStar(require("./engines"), exports);
//# sourceMappingURL=index.js.map