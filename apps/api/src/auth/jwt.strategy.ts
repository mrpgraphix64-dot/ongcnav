import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => req?.cookies?.jwt || req?.cookies?.admin_token,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'ongc-navratri-jwt-secret-key-2026'),
    });
  }

  async validate(payload: any) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException();
    }

    // Demo admin bypass virtual user
    if (payload.isDemo) {
      return {
        id: BigInt(0),
        staffId: 'DEMO-ADMIN',
        name: 'Demo Admin',
        email: 'demo.admin@ongc.co.in',
        role: 'SUPER_ADMIN',
        status: 'active',
        isDemo: true,
      };
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
