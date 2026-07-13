import { db } from '../config/firebase';
import { COLLECTIONS, REVENUE } from '../constants';
import { Order, Vendor } from '../models';

export class RevenueSplitService {
    /**
     * Tự động tính toán dòng tiền và thuế khi đơn hàng thanh toán thành công
     */
    static async processOrderPayment(orderId: string, orderData: Order) {
        if (orderData.accountingSplit) {
            console.log(`[Order ${orderId}] Đã có thông tin đối soát. Bỏ qua.`);
            return;
        }

        const vendorId = orderData.vendor.vendorId;
        const vendorDoc = await db.collection(COLLECTIONS.VENDORS).doc(vendorId).get();
        
        if (!vendorDoc.exists) {
            throw new Error(`Gian hàng ${vendorId} không tồn tại`);
        }

        const vendor = vendorDoc.data() as Vendor;
        const commissionRate = vendor.financialConfig?.revenueShareRate ?? REVENUE.DEFAULT_COMMISSION_RATE;
        const totalAmount = orderData.totalAmount;

        // Tính toán dòng tiền
        const platformCommission = Math.round(totalAmount * commissionRate);
        const taxAmount = Math.round(totalAmount * REVENUE.DEFAULT_TAX_RATE);
        const vendorReceivable = totalAmount - platformCommission; // Số tiền thực trả về cho gian hàng

        const accountingSplit = {
            platformCommission,
            vendorReceivable,
            taxAmount
        };

        // Cập nhật lại đơn hàng trên Firestore
        await db.collection(COLLECTIONS.ORDERS).doc(orderId).update({
            accountingSplit,
            updatedAt: new Date()
        });

        console.log(`[Order ${orderId}] Đã xử lý đối soát thành công. Sàn: ${platformCommission}, Gian hàng: ${vendorReceivable}`);
    }
}
