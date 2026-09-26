import { PrismaService } from '../../prisma/prisma.service';
import { getDefaultPermissionsForRole, UserRole } from '@ongc/shared-types';

export const USER_PAGE_PERMISSIONS_SETTING_PREFIX = 'page_permissions:user:';

/**
 * Loads stored page permissions for a user from the settings table.
 * If no custom setting exists, returns the role's safe domain defaults.
 * SUPER_ADMIN always receives all permissions.
 */
export async function fetchUserPagePermissions(
  prisma: PrismaService,
  userId: bigint | string,
  role: string,
): Promise<string[]> {
  const roleUpper = (role || '').toUpperCase().trim();

  // Super Admin is unrestricted
  if (roleUpper === UserRole.SUPER_ADMIN) {
    return getDefaultPermissionsForRole(UserRole.SUPER_ADMIN);
  }

  // Only domain admins have configurable page permissions
  if (roleUpper !== UserRole.COMMERCIAL_ADMIN && roleUpper !== UserRole.EMPLOYEE_ADMIN) {
    return [];
  }

  try {
    const key = `${USER_PAGE_PERMISSIONS_SETTING_PREFIX}${userId.toString()}`;
    const setting = await prisma.setting.findUnique({
      where: { key },
    });

    if (setting?.value) {
      const parsed = JSON.parse(setting.value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Fall back to safe defaults if setting is missing or corrupt
  }

  return getDefaultPermissionsForRole(roleUpper);
}
