import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "@agenda-app/shared";

export const REQUIRED_ROLES = "requiredRoles";
export const Roles = (...roles: UserRole[]) => SetMetadata(REQUIRED_ROLES, roles);
