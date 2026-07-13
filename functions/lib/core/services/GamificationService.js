"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GamificationService = void 0;
const firebase_1 = require("../config/firebase");
const constants_1 = require("../constants");
class GamificationService {
    /**
     * Tự động cộng điểm và lưu vào sổ cái (Sử dụng Firestore Transaction đảm bảo ACID)
     */
    static async awardPoints(userId, points, transactionType, referenceId) {
        const userRef = firebase_1.db.collection(constants_1.COLLECTIONS.USERS).doc(userId);
        const pointHistoryRef = userRef.collection(constants_1.COLLECTIONS.POINT_HISTORY).doc();
        await firebase_1.db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) {
                console.log(`User ${userId} không tồn tại, bỏ qua việc cộng điểm.`);
                return;
            }
            const currentPoints = userDoc.data()?.totalPoints || 0;
            const newPoints = currentPoints + points;
            // Thuật toán xét duyệt thăng hạng (Tier)
            let newTier = userDoc.data()?.tier || 'member';
            if (newPoints >= constants_1.GAMIFICATION.TIERS.DIAMOND)
                newTier = 'diamond';
            else if (newPoints >= constants_1.GAMIFICATION.TIERS.GOLD)
                newTier = 'gold';
            else if (newPoints >= constants_1.GAMIFICATION.TIERS.SILVER)
                newTier = 'silver';
            // 1. Cập nhật tổng điểm và tier cho User
            transaction.update(userRef, {
                totalPoints: newPoints,
                tier: newTier
            });
            // 2. Ghi log vào sổ cái Point History
            transaction.set(pointHistoryRef, {
                amount: points,
                transactionType: transactionType,
                referenceId: referenceId,
                createdAt: firebase_1.admin.firestore.FieldValue.serverTimestamp()
            });
        });
        console.log(`Đã cộng ${points} điểm cho user ${userId} (Hành động: ${transactionType})`);
    }
}
exports.GamificationService = GamificationService;
//# sourceMappingURL=GamificationService.js.map