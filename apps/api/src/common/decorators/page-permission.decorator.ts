import { SetMetadata } from '@nestjs/common';

export const PAGE_PERMISSION_KEY = 'page_permission';

/**
 * Decorator to enforce granular page-level permissions on API controller handlers or classes.
 * Evaluates against the user's assigned page permissions (or safe domain defaults).
 *
 * If multiple permissions are specified, ANY matching permission grants access (OR semantics).
 * SUPER_ADMIN is always unrestricted.
 */
export const RequirePagePermission = (...permissions: string[]) =>
  SetMetadata(PAGE_PERMISSION_KEY, permissions);
