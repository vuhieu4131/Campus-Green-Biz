"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLLECTIONS = exports.REVENUE = exports.GAMIFICATION = void 0;
exports.GAMIFICATION = {
    POINTS_PER_POST: 10,
    POINTS_PER_LIKE: 1,
    POINTS_PER_SHARE: 5,
    TIERS: {
        BRONZE: 0,
        SILVER: 100,
        GOLD: 500,
        DIAMOND: 1000
    }
};
exports.REVENUE = {
    DEFAULT_COMMISSION_RATE: 0.05, // 5% mặc định
    DEFAULT_TAX_RATE: 0.08 // 8% VAT
};
exports.COLLECTIONS = {
    USERS: 'users',
    POSTS: 'posts',
    ORDERS: 'orders',
    VENDORS: 'vendors',
    PRODUCTS: 'products',
    VOUCHERS: 'vouchers',
    USER_VOUCHERS: 'user_vouchers',
    POINT_HISTORY: 'point_history',
    LIKES: 'likes',
    COMMENTS: 'comments'
};
//# sourceMappingURL=index.js.map