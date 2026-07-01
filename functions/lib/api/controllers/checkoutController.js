"use strict";
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
exports.generateVietQR = void 0;
const functions = __importStar(require("firebase-functions"));
// HTTP Function (API Endpoint) dùng để sinh VietQR Code hoặc tạo đơn hàng
exports.generateVietQR = functions.https.onRequest((req, res) => {
    // Logic sẽ triển khai thực tế ở Phase 2: nhận thông tin đơn hàng, gọi API ngân hàng (như VietQR.io)
    // để lấy mã QR động trả về cho Zalo Mini App.
    res.status(200).send({
        success: true,
        message: 'VietQR Generated (Mock)',
        qrData: '00020101021138580010A000000727012800069704030114190333333333330208QRIBFTTA530370454061000005802VN62180814ThanhToanDonHang6304A1B2'
    });
});
//# sourceMappingURL=checkoutController.js.map