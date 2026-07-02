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
exports.onOrderUpdated = void 0;
const functions = __importStar(require("firebase-functions"));
const constants_1 = require("../core/constants");
const RevenueSplitService_1 = require("../core/services/RevenueSplitService");
/**
 * Lắng nghe sự thay đổi của Đơn hàng. Nếu trạng thái chuyển thành 'paid',
 * tự động tính toán chia sẻ doanh thu hoa hồng.
 */
exports.onOrderUpdated = functions.firestore
    .document(`${constants_1.COLLECTIONS.ORDERS}/{orderId}`)
    .onUpdate(async (change, context) => {
    const orderId = context.params.orderId;
    const previousData = change.before.data();
    const newData = change.after.data();
    // Chỉ chạy khi trạng thái thanh toán chuyển từ bất kỳ sang 'paid'
    if (previousData.paymentInfo.status !== 'paid' && newData.paymentInfo.status === 'paid') {
        console.log(`Bắt đầu xử lý đối soát cho đơn hàng: ${orderId}`);
        try {
            await RevenueSplitService_1.RevenueSplitService.processOrderPayment(orderId, newData);
        }
        catch (error) {
            console.error(`Lỗi khi xử lý đối soát đơn hàng ${orderId}:`, error);
        }
    }
});
//# sourceMappingURL=orderTriggers.js.map