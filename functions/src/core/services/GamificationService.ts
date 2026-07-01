import { db, admin } from '../config/firebase';
import { COLLECTIONS, GAMIFICATION } from '../constants';

export class GamificationService {
    
    /**
     * Tự động cộng điểm và lưu vào sổ cái (Sử dụng Firestore Transaction đảm bảo ACID)
     */
    static async awardPoints(userId: string, points: number, transactionType: string, referenceId: string) {
        const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
        const pointHistoryRef = userRef.collection(COLLECTIONS.POINT_HISTORY).doc();

        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            
            if (!userDoc.exists) {
                console.log(`User ${userId} không tồn tại, bỏ qua việc cộng điểm.`);
                return;
            }

            const currentPoints = userDoc.data()?.totalPoints || 0;
            const newPoints = currentPoints + points;

            // Thuật toán xét duyệt thăng hạng (Tier)
            let newTier = userDoc.data()?.tier || 'member';
            if (newPoints >= GAMIFICATION.TIERS.DIAMOND) newTier = 'diamond';
            else if (newPoints >= GAMIFICATION.TIERS.GOLD) newTier = 'gold';
            else if (newPoints >= GAMIFICATION.TIERS.SILVER) newTier = 'silver';

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
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        console.log(`Đã cộng ${points} điểm cho user ${userId} (Hành động: ${transactionType})`);
    }
}
