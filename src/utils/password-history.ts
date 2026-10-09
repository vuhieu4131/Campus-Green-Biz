export interface PasswordCommitEntry {
  commitId: string;
  oldPassword: string;
  newPassword: string;
  reason: string;
  changedBy: string;
  source: "admin_change" | "admin_revert" | "user_change" | "register" | "login_sync";
  revertedFromCommitId?: string;
  createdAt: string;
}

/**
 * Tạo mã hash ngắn 7 ký tự giống git commit (VD: "a8f3c21")
 */
export const generateCommitHash = (seed = ""): string => {
  const raw = `${Date.now()}-${Math.random().toString(36).slice(2)}-${seed}`;
  let hash1 = 0x811c9dc5;
  let hash2 = 0x01000193;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i);
    hash1 ^= ch;
    hash1 = Math.imul(hash1, 0x01000193);
    hash2 ^= ch + i;
    hash2 = Math.imul(hash2, 0x85ebca6b);
  }
  const hex =
    ((hash1 >>> 0).toString(16).padStart(8, "0") +
      (hash2 >>> 0).toString(16).padStart(8, "0")).toLowerCase();
  return hex.slice(0, 7);
};

/**
 * Khởi tạo một bản ghi commit mật khẩu mới
 */
export const createPasswordCommit = (params: {
  oldPassword?: string | null;
  newPassword: string;
  reason: string;
  changedBy: string;
  source: PasswordCommitEntry["source"];
  revertedFromCommitId?: string;
  createdAt?: string;
}): PasswordCommitEntry => {
  const createdAt = params.createdAt || new Date().toISOString();
  const oldPassword =
    params.oldPassword !== undefined &&
    params.oldPassword !== null &&
    String(params.oldPassword).trim() !== ""
      ? String(params.oldPassword)
      : "(Chưa ghi nhận)";
  const newPassword = String(params.newPassword);
  const reason = String(params.reason || "").trim() || "Cập nhật mật khẩu";

  const commit: PasswordCommitEntry = {
    commitId: generateCommitHash(`${oldPassword}->${newPassword}:${createdAt}`),
    oldPassword,
    newPassword,
    reason,
    changedBy: params.changedBy,
    source: params.source,
    createdAt,
  };

  if (params.revertedFromCommitId) {
    commit.revertedFromCommitId = params.revertedFromCommitId;
  }

  return commit;
};

/**
 * Đẩy commit mới lên đầu mảng lịch sử (HEAD luôn ở vị trí index 0)
 */
export const appendPasswordCommit = (
  existingHistory: any[] | undefined | null,
  newCommit: PasswordCommitEntry
): PasswordCommitEntry[] => {
  const safeExisting = Array.isArray(existingHistory)
    ? existingHistory.filter(
        (item) => item && typeof item === "object" && item.newPassword !== undefined
      )
    : [];
  return [newCommit, ...safeExisting];
};

/**
 * Kiểm tra các lớp điều kiện an toàn trước khi Admin đổi mật khẩu
 */
export const validateAdminPasswordChange = (params: {
  currentPassword?: string | null;
  newPassword: string;
  reason: string;
  isConfirmedStep2?: boolean;
  requireStep2?: boolean;
}): { valid: boolean; error?: string } => {
  const trimmedNew = String(params.newPassword || "").trim();
  const trimmedReason = String(params.reason || "").trim();
  const currentPass =
    params.currentPassword !== undefined && params.currentPassword !== null
      ? String(params.currentPassword)
      : "";

  if (!trimmedNew || trimmedNew.length < 6) {
    return {
      valid: false,
      error: "Mật khẩu mới phải có ít nhất 6 ký tự!",
    };
  }

  if (currentPass && trimmedNew === currentPass) {
    return {
      valid: false,
      error: "Mật khẩu mới đang trùng với mật khẩu hiện tại của người dùng!",
    };
  }

  if (!trimmedReason || trimmedReason.length < 3) {
    return {
      valid: false,
      error: "Vui lòng nhập lý do / ghi chú commit (tối thiểu 3 ký tự) để lưu vết!",
    };
  }

  if (params.requireStep2 && !params.isConfirmedStep2) {
    return {
      valid: false,
      error: "Vui lòng tích chọn ô xác nhận cam kết trước khi lưu thay đổi!",
    };
  }

  return { valid: true };
};

/**
 * Trích xuất danh sách các mật khẩu từng dùng của tài khoản để phục vụ đồng bộ Firebase Auth
 */
export const getCandidatePasswordsFromRecord = (userDoc: any): string[] => {
  if (!userDoc || typeof userDoc !== "object") return ["123456"];
  const candidates: string[] = [];
  const addCandidate = (val: any) => {
    if (!val || typeof val !== "string") return;
    const trimmed = val.trim();
    if (
      !trimmed ||
      trimmed === "(Chưa ghi nhận)" ||
      trimmed === "(Chưa có)" ||
      candidates.includes(trimmed)
    ) {
      return;
    }
    candidates.push(trimmed);
  };

  addCandidate(userDoc.password);
  if (Array.isArray(userDoc.passwordHistory)) {
    for (const entry of userDoc.passwordHistory) {
      if (entry && typeof entry === "object") {
        addCandidate(entry.newPassword);
        addCandidate(entry.oldPassword);
      }
    }
  }
  addCandidate("123456");
  return candidates;
};
