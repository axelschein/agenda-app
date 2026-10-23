export const USER_ROLES = ["ADMIN", "CLIENT"] as const;

export type UserRole = (typeof USER_ROLES)[number];
