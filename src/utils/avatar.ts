const DEFAULT_AVATARS = [
  "https://firebasestorage.googleapis.com/v0/b/campusbizproject.firebasestorage.app/o/avatars%2F000_OK_2.png?alt=media&token=ce18d6e3-2a7f-40a2-bd67-1a07412bdacc",
  "https://firebasestorage.googleapis.com/v0/b/campusbizproject.firebasestorage.app/o/avatars%2F000_OK.png?alt=media&token=05ea60d9-853e-4214-aa05-aea0f4282617",
  "https://firebasestorage.googleapis.com/v0/b/campusbizproject.firebasestorage.app/o/avatars%2F000_OK_1.png?alt=media&token=4ebfc82b-8e77-439a-805c-227e0dadbc65"
];

export const getDefaultAvatar = (userId?: string | null): string => {
  if (!userId) {
    return DEFAULT_AVATARS[0];
  }
  
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % DEFAULT_AVATARS.length;
  return DEFAULT_AVATARS[index];
};

export const getValidAvatar = (url?: string | null, userId?: string | null): string => {
  if (!url || url.includes("pravatar.cc") || url.includes("default_avatar.png")) {
    return getDefaultAvatar(userId);
  }
  return url;
};
