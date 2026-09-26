import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, getDefaultPermissionsForRole } from '@ongc/shared-types';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PAGE_PERMISSION_KEY } from '../decorators/page-permission.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PAGE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If neither roles nor page permissions are restricted on this endpoint, allow access
    if ((!requiredRoles || requiredRoles.length === 0) && (!requiredPermissions || requiredPermissions.length === 0)) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException('Unauthorized: No user role context present.');
    }

    // Super Admin has unrestricted access to everything
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Check Role-level permissions if defined
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.includes(user.role);
      if (!hasRole) {
        throw new ForbiddenException(
          `Unauthorized: Your role (${user.role}) does not have permission to perform this action.`,
        );
      }
    }

    // Check Page-level permissions if defined and user is domain admin (COMMERCIAL_ADMIN or EMPLOYEE_ADMIN)
    if (requiredPermissions && requiredPermissions.length > 0) {
      const roleUpper = (user.role || '').toUpperCase();
      if (roleUpper === UserRole.COMMERCIAL_ADMIN || roleUpper === UserRole.EMPLOYEE_ADMIN) {
        const userPermissions: string[] = user.pagePermissions ?? getDefaultPermissionsForRole(roleUpper);
        const hasPermission = requiredPermissions.some((perm) => userPermissions.includes(perm));
        if (!hasPermission) {
          throw new ForbiddenException(
            `Access Denied: Missing required page permission (${requiredPermissions.join(', ')}).`,
          );
        }
      }
    }

    return true;
  }
}
