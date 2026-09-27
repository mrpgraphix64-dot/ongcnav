import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SETTING_MAINTENANCE_MODE, isMaintenanceModeActive } from '@ongc/shared-types';

@Injectable()
export class PublicMaintenanceGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(_context: ExecutionContext): Promise<boolean> {
    try {
      const setting = await this.prisma.setting.findUnique({
        where: { key: SETTING_MAINTENANCE_MODE },
      });

      if (isMaintenanceModeActive(setting?.value)) {
        throw new ServiceUnavailableException({
          success: false,
          statusCode: 503,
          maintenance: true,
          message:
            "ONGC Navratri 2026 is currently undergoing scheduled maintenance. Public registrations and ticket purchases are temporarily suspended. Please try again shortly.",
        });
      }
    } catch (err: any) {
      if (err instanceof ServiceUnavailableException) {
        throw err;
      }
    }

    return true;
  }
}
