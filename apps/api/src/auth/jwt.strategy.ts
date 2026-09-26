import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordResetService } from './password-reset.service';
import { getRequiredJwtSecret } from '../common/security/jwt-secret.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly passwordResetService: PasswordResetService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => req?.cookies?.jwt || req?.cookies?.admin_token,
      ]),
      ignoreExpiration: false,
      secretOrKey: getRequiredJwtSecret(configService),
    });
  }

  async validate(payload: any) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException();
    }

    if (payload.purpose === 'password_reset') {
      throw new UnauthorizedException(
        'Password reset authorization tokens cannot authenticate application APIs.',
      );
    }

    const isRevoked = await this.passwordResetService.isTokenRevoked(payload.sub, payload.iat);
    if (isRevoked) {
      throw new UnauthorizedException(
        'Session expired due to a recent password reset. Please sign in again.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(payload.sub) },
      include: {
        gateUsers: {
          include: {
            gate: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is inactive or not found.');
    }

    return {
      id: user.id,
      staffId: user.staffId,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      assignedGates: user.gateUsers.map((gu) => gu.gate),
    };
  }
}
