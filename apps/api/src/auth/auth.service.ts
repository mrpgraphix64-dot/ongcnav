import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto) {
    const { identifier, password } = loginDto;
    const cleanIdentifier = identifier.trim();

    // 1. Search database user by email or staffId
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: cleanIdentifier, mode: 'insensitive' } },
          { staffId: { equals: cleanIdentifier, mode: 'insensitive' } },
        ],
      },
      include: {
        gateUsers: {
          include: {
            gate: true,
          },
        },
      },
    });

    if (user) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials. Please verify your password.');
      }

      if (!user.isActive) {
        throw new ForbiddenException('Staff account is inactive. Please contact the administrator.');
      }

      return this.generateTokenResponse(user);
    }

    // 2. Emergency fallback admin — requires ADMIN_EMAIL/ADMIN_PASSWORD to be
    // explicitly configured. No hardcoded default credentials: if either is
    // unset, this path can never authenticate (fails closed), rather than
    // falling back to a well-known default password.
    const fallbackEmail = this.configService.get<string>('ADMIN_EMAIL')?.toLowerCase();
    const fallbackPassword = this.configService.get<string>('ADMIN_PASSWORD');

    if (
      fallbackEmail &&
      fallbackPassword &&
      (cleanIdentifier.toLowerCase() === 'admin' || cleanIdentifier.toLowerCase() === fallbackEmail) &&
      password === fallbackPassword
    ) {
      const payload = {
        sub: '0',
        staffId: 'SUPER-ADMIN',
        email: fallbackEmail,
        name: 'Portal Administrator',
        role: 'SUPER_ADMIN',
      };

      const token = this.jwtService.sign(payload);

      return {
        accessToken: token,
        user: {
          id: '0',
          staffId: 'SUPER-ADMIN',
          email: fallbackEmail,
          name: 'Portal Administrator',
          role: 'SUPER_ADMIN',
          assignedGates: [],
        },
      };
    }

    throw new UnauthorizedException('Invalid credentials. Enter your registered Staff Email or Staff ID.');
  }

  private generateTokenResponse(user: any) {
    const payload = {
      sub: user.id.toString(),
      staffId: user.staffId,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const token = this.jwtService.sign(payload);

    return {
      accessToken: token,
      user: {
        id: user.id.toString(),
        staffId: user.staffId,
        email: user.email,
        name: user.name,
        role: user.role,
        assignedGates: user.gateUsers ? user.gateUsers.map((gu: any) => gu.gate) : [],
      },
    };
  }
}
