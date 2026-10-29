export const USER_ROLES = ["ADMIN", "CLIENT", "BARBER"] as const;

export type UserRole = (typeof USER_ROLES)[number];
