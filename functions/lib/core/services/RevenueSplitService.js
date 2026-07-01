"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevenueSplitService = void 0;
const firebase_1 = require("../config/firebase");
const constants_1 = require("../constants");
class RevenueSplitService {
    /**
     * Tự động tính toán dòng tiền và thuế khi đơn hàng thanh toán thành công
     */
    static async processOrderPayment(orderId, orderData) {
        if (orderData.accountingSplit) {
            console.log(`[Order ${orderId}] Đã có thông tin đối soát. Bỏ qua.`);
            return;
        }
        const vendorId = orderData.vendor.vendorId;
        const vendorDoc = await firebase_1.db.collection(constants_1.COLLECTIONS.VENDORS).doc(vendorId).get();
        if (!vendorDoc.exists) {
            throw new Error(`Gian hàng ${vendorId} không tồn tại`);
        }
        const vendor = vendorDoc.data();
        const commissionRate = vendor.financialConfig?.revenueShareRate ?? constants_1.REVENUE.DEFAULT_COMMISSION_RATE;
        const totalAmount = orderData.totalAmount;
        // Tính toán dòng tiền
        const platformCommission = Math.round(totalAmount * commissionRate);
        const taxAmount = Math.round(totalAmount * constants_1.REVENUE.DEFAULT_TAX_RATE);
        const vendorReceivable = totalAmount - platformCommission; // Số tiền thực trả về cho gian hàng
        const accountingSplit = {
            platformCommission,
            vendorReceivable,
            taxAmount
        };
        // Cập nhật lại đơn hàng trên Firestore
        await firebase_1.db.collection(constants_1.COLLECTIONS.ORDERS).doc(orderId).update({
            accountingSplit,
            updatedAt: new Date()
        });
        console.log(`[Order ${orderId}] Đã xử lý đối soát thành công. Sàn: ${platformCommission}, Gian hàng: ${vendorReceivable}`);
    }
}
exports.RevenueSplitService = RevenueSplitService;
//# sourceMappingURL=RevenueSplitService.js.map