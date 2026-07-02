import * as functions from 'firebase-functions';
import { COLLECTIONS } from '../core/constants';
import { Order } from '../core/models';
import { RevenueSplitService } from '../core/services/RevenueSplitService';

/**
 * Lắng nghe sự thay đổi của Đơn hàng. Nếu trạng thái chuyển thành 'paid', 
 * tự động tính toán chia sẻ doanh thu hoa hồng.
 */
export const onOrderUpdated = functions.firestore
    .document(`${COLLECTIONS.ORDERS}/{orderId}`)
    .onUpdate(async (change, context) => {
        const orderId = context.params.orderId;
        const previousData = change.before.data() as Order;
        const newData = change.after.data() as Order;

        // Chỉ chạy khi trạng thái thanh toán chuyển từ bất kỳ sang 'paid'
        if (previousData.paymentInfo.status !== 'paid' && newData.paymentInfo.status === 'paid') {
            console.log(`Bắt đầu xử lý đối soát cho đơn hàng: ${orderId}`);
            try {
                await RevenueSplitService.processOrderPayment(orderId, newData);
            } catch (error) {
                console.error(`Lỗi khi xử lý đối soát đơn hàng ${orderId}:`, error);
            }
        }
    });
