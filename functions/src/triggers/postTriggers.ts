import * as functions from 'firebase-functions';
import { COLLECTIONS, GAMIFICATION } from '../core/constants';
import { GamificationService } from '../core/services/GamificationService';
import { db, admin } from '../core/config/firebase';

/**
 * Lắng nghe khi có một User mới thả tim bài viết
 * Tăng likeCount của Post và cộng điểm cho tác giả bài viết
 */
export const onPostLiked = functions.firestore
    .document(`${COLLECTIONS.POSTS}/{postId}/${COLLECTIONS.LIKES}/{userId}`)
    .onCreate(async (snap, context) => {
        const postId = context.params.postId;
        const likerId = context.params.userId;

        try {
            // 1. Lấy thông tin bài viết để biết ai là tác giả
            const postRef = db.collection(COLLECTIONS.POSTS).doc(postId);
            const postDoc = await postRef.get();
            
            if (!postDoc.exists) return;

            const authorId = postDoc.data()?.authorId;

            // 2. Tăng likeCount của bài viết lên 1 (Dùng FieldValue.increment để chống xung đột)
            await postRef.update({
                'metrics.likeCount': admin.firestore.FieldValue.increment(1)
            });

            // 3. Cộng điểm cho tác giả bài viết
            // Không cộng điểm cho chính mình tự like
            if (authorId !== likerId) {
                await GamificationService.awardPoints(
                    authorId, 
                    GAMIFICATION.POINTS_PER_LIKE, 
                    'EARN_LIKE', 
                    postId
                );
            }
        } catch (error) {
            console.error(`Lỗi khi xử lý thả tim bài viết ${postId}:`, error);
        }
    });
