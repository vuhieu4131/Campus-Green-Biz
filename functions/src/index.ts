import * as orderTriggers from './triggers/orderTriggers';
import * as postTriggers from './triggers/postTriggers';
import * as checkoutController from './api/controllers/checkoutController';
import * as rewardController from './api/controllers/rewardController';

// 1. Export Triggers (Background Workers lắng nghe sự kiện Firestore)
export const onOrderUpdated = orderTriggers.onOrderUpdated;
export const onPostLiked = postTriggers.onPostLiked;

// 2. Export HTTP APIs (Client trực tiếp gọi)
export const api = {
    checkout: checkoutController.generateVietQR,
    reward: rewardController.redeemVoucher
};
