const CACHE_KEY_PREFIX = "cgb_user_profile_";
const ACTIVE_UID_KEY = "cgb_active_uid";

const memoryCache = new Map<string, any>();

const getStorage = (): Storage | null => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== "undefined" && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage;
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
};

export const isGuestOrUnlogged = (
  user: { uid?: string; email?: string | null } | null | undefined
): boolean => {
  return !user || !user.uid || user.email === "guest@campus.com";
};

export const normalizeUserData = (uid: string, rawData: any): any => {
  if (!rawData || typeof rawData !== "object") return null;
  const isShop =
    rawData.role === "provider" || rawData.collectionName === "shops";
  const resolvedName = isShop
    ? rawData.name || rawData.shopName || rawData.fullName || ""
    : rawData.fullName || rawData.name || rawData.shopName || "";
  const resolvedFullName =
    rawData.fullName || rawData.name || rawData.shopName || "";
  const resolvedAvatar = rawData.avatar || rawData.shopAvatar || "";

  return {
    ...rawData,
    _cachedUid: uid,
    ...(resolvedName ? { name: resolvedName } : {}),
    ...(resolvedFullName ? { fullName: resolvedFullName } : {}),
    ...(resolvedAvatar ? { avatar: resolvedAvatar } : {}),
  };
};

export const getCachedUserData = (uid?: string | null): any | null => {
  if (!uid) return null;

  const mem = memoryCache.get(uid);
  if (mem && mem._cachedUid === uid) {
    return mem;
  }

  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(CACHE_KEY_PREFIX + uid);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed._cachedUid === uid) {
      memoryCache.set(uid, parsed);
      return parsed;
    }
  } catch (e) {
    console.warn("Could not read cached user profile:", e);
  }
  return null;
};

export const getLastActiveUid = (): string | null => {
  const storage = getStorage();
  if (!storage) return null;
  try {
    return storage.getItem(ACTIVE_UID_KEY);
  } catch {
    return null;
  }
};

export const getInitialCachedUserData = (
  currentUser?: { uid?: string; email?: string | null } | null
): any | null => {
  if (currentUser) {
    if (isGuestOrUnlogged(currentUser)) return null;
    return getCachedUserData(currentUser.uid);
  }
  const lastUid = getLastActiveUid();
  if (lastUid) {
    return getCachedUserData(lastUid);
  }
  return null;
};

export const setCachedUserData = (
  uid: string | null | undefined,
  data: any
): any => {
  if (!uid || !data) return data;
  const normalized = normalizeUserData(uid, data);
  if (!normalized) return data;

  memoryCache.set(uid, normalized);
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(CACHE_KEY_PREFIX + uid, JSON.stringify(normalized));
      storage.setItem(ACTIVE_UID_KEY, uid);
    } catch (e) {
      console.warn("Could not save user profile to cache:", e);
    }
  }
  return normalized;
};

export const updateCachedUserData = (
  uid: string | null | undefined,
  partial: Record<string, any>
): any | null => {
  if (!uid || !partial) return null;
  const existing = getCachedUserData(uid) || {};
  return setCachedUserData(uid, { ...existing, ...partial });
};

export const clearCachedUserData = (uid?: string | null): void => {
  if (uid) {
    memoryCache.delete(uid);
  } else {
    memoryCache.clear();
  }

  const storage = getStorage();
  if (!storage) return;

  try {
    if (uid) {
      storage.removeItem(CACHE_KEY_PREFIX + uid);
      if (storage.getItem(ACTIVE_UID_KEY) === uid) {
        storage.removeItem(ACTIVE_UID_KEY);
      }
    } else {
      storage.removeItem(ACTIVE_UID_KEY);
      const keysToRemove: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && k.startsWith(CACHE_KEY_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => storage.removeItem(k));
    }
  } catch (e) {
    console.warn("Could not clear cached user profile:", e);
  }
};

export interface StoreHeaderState {
  isRealUser: boolean;
  isLoading: boolean;
  name: string;
  avatar: string;
  rankPoints: number;
  spendingPoints: number;
  rankName: string;
}

export const getRankNameFromPoints = (p: number): string => {
  const pts = p || 0;
  if (pts < 500) return "Hạng Đồng";
  if (pts < 1000) return "Hạng Bạc";
  if (pts < 2000) return "Hạng Vàng";
  return "Hạng Kim Cương";
};

const DEFAULT_STORE_AVATAR =
  "https://stc-zalopay-images.zg.vn/v2/0/images/avatars/default_avatar.png";

export const resolveStoreHeaderState = (params: {
  currentUser: { uid?: string; email?: string | null } | null | undefined;
  userData: any;
  loadingUser: boolean;
}): StoreHeaderState => {
  const { currentUser, userData, loadingUser } = params;
  const hasValidUser = Boolean(
    currentUser && currentUser.uid && currentUser.email !== "guest@campus.com"
  );
  // Ensure userData belongs to currentUser if _cachedUid is present
  const validUserData =
    hasValidUser &&
    userData &&
    (!userData._cachedUid || userData._cachedUid === currentUser?.uid)
      ? userData
      : null;

  const isLoading = Boolean(hasValidUser && loadingUser && !validUserData);

  if (!hasValidUser) {
    return {
      isRealUser: false,
      isLoading: false,
      name: "Khách",
      avatar: DEFAULT_STORE_AVATAR,
      rankPoints: 0,
      spendingPoints: 0,
      rankName: getRankNameFromPoints(0),
    };
  }

  if (isLoading) {
    return {
      isRealUser: true,
      isLoading: true,
      name: "",
      avatar: DEFAULT_STORE_AVATAR,
      rankPoints: 0,
      spendingPoints: 0,
      rankName: getRankNameFromPoints(0),
    };
  }

  const fallbackEmailName = currentUser?.email
    ? currentUser.email.split("@")[0]
    : "Thành viên";

  const name =
    validUserData?.fullName ||
    validUserData?.name ||
    validUserData?.shopName ||
    fallbackEmailName;

  const avatar =
    validUserData?.avatar || validUserData?.shopAvatar || DEFAULT_STORE_AVATAR;

  const rankPoints = validUserData?.rankPoints || 0;
  const spendingPoints =
    validUserData?.spendingPoints ?? validUserData?.points ?? 0;

  return {
    isRealUser: true,
    isLoading: false,
    name,
    avatar,
    rankPoints,
    spendingPoints,
    rankName: getRankNameFromPoints(rankPoints),
  };
};

export type ProfileViewMode =
  | "target_profile"
  | "guest"
  | "loading"
  | "admin"
  | "provider_dashboard"
  | "settings"
  | "member";

export const resolveProfileViewMode = (params: {
  profileId?: string | null;
  currentUser: { uid?: string; email?: string | null } | null | undefined;
  userData: any;
  loadingUserData: boolean;
  showProviderDashboard?: boolean;
  showFullProfile?: boolean;
}): ProfileViewMode => {
  const {
    profileId,
    currentUser,
    userData,
    loadingUserData,
    showProviderDashboard = false,
    showFullProfile = true,
  } = params;

  if (profileId) {
    return "target_profile";
  }

  if (isGuestOrUnlogged(currentUser)) {
    return "guest";
  }

  const validUserData =
    userData &&
    (!userData._cachedUid || userData._cachedUid === currentUser?.uid)
      ? userData
      : null;

  if (loadingUserData && !validUserData) {
    return "loading";
  }

  const role = validUserData?.role;

  if (role === "admin" || role === "admin_phu") {
    return "admin";
  }

  if (role === "provider" && showProviderDashboard) {
    return "provider_dashboard";
  }

  if (!showFullProfile) {
    return "settings";
  }

  return "member";
};
