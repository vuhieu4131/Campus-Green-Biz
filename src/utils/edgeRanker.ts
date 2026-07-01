export interface RawPost {
  id: string; // The Firestore document ID
  authorId?: string;
  authorName?: string;
  authorAvatar?: string;
  content?: string;
  images?: string[];
  privacy?: string;
  createdAt: any; // Firestore Timestamp
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  hasShoppableTags?: boolean;
  isPinned?: boolean;
  likedBy?: string[];
}

export const sortPostsOnEdge = (posts: RawPost[]): RawPost[] => {
  const now = Date.now();

  return posts
    .map((post) => {
      // 1. Calculate hours elapsed
      // Handle Firebase Timestamp format securely
      const createdTime = post.createdAt?.toMillis ? post.createdAt.toMillis() : (post.createdAt?.seconds ? post.createdAt.seconds * 1000 : Date.now());
      const hoursElapsed = Math.max(0, (now - createdTime) / (1000 * 60 * 60));

      // 2. Default to 0 if fields are missing
      const likes = post.likesCount || 0;
      const comments = post.commentsCount || 0;
      const shares = post.sharesCount || 0;
      const hasTags = post.hasShoppableTags || false;

      // 3. Algorithm weights
      const engagementScore = (likes * 1) + (comments * 3) + (shares * 5);
      const commercialBonus = hasTags ? 50 : 0;
      
      // Time Decay formula
      const timeDecay = 1 / Math.pow(hoursElapsed + 2, 1.5);

      // 4. Final Score
      let finalScore = (engagementScore + commercialBonus) * timeDecay;
      
      // Bonus for pinned post
      if (post.isPinned) {
        finalScore += 999999; // Pin to top
      }

      return { ...post, _edgeScore: finalScore };
    })
    // 5. Sort DESC
    .sort((a, b) => (b._edgeScore as number) - (a._edgeScore as number));
};
