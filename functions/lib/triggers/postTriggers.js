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
exports.onPostLiked = void 0;
const functions = __importStar(require("firebase-functions"));
const constants_1 = require("../core/constants");
const GamificationService_1 = require("../core/services/GamificationService");
const firebase_1 = require("../core/config/firebase");
/**
 * Lắng nghe khi có một User mới thả tim bài viết
 * Tăng likeCount của Post và cộng điểm cho tác giả bài viết
 */
exports.onPostLiked = functions.firestore
    .document(`${constants_1.COLLECTIONS.POSTS}/{postId}/${constants_1.COLLECTIONS.LIKES}/{userId}`)
    .onCreate(async (snap, context) => {
    const postId = context.params.postId;
    const likerId = context.params.userId;
    try {
        // 1. Lấy thông tin bài viết để biết ai là tác giả
        const postRef = firebase_1.db.collection(constants_1.COLLECTIONS.POSTS).doc(postId);
        const postDoc = await postRef.get();
        if (!postDoc.exists)
            return;
        const authorId = postDoc.data()?.authorId;
        // 2. Tăng likeCount của bài viết lên 1 (Dùng FieldValue.increment để chống xung đột)
        await postRef.update({
            'metrics.likeCount': firebase_1.admin.firestore.FieldValue.increment(1)
        });
        // 3. Cộng điểm cho tác giả bài viết
        // Không cộng điểm cho chính mình tự like
        if (authorId !== likerId) {
            await GamificationService_1.GamificationService.awardPoints(authorId, constants_1.GAMIFICATION.POINTS_PER_LIKE, 'EARN_LIKE', postId);
        }
    }
    catch (error) {
        console.error(`Lỗi khi xử lý thả tim bài viết ${postId}:`, error);
    }
});
//# sourceMappingURL=postTriggers.js.map