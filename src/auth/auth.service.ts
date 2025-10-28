import { Injectable } from '@nestjs/common';
// ✅ ĐÚNG - Runtime imports
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async loginGoogle(profile: {
    provider: 'google';
    providerId: string;
    email: string | null;
    name?: string | null;
    avatarUrl?: string | null;
  }) {
    // upsert theo providerId để đảm bảo 1-1
    // Prefer not to insert explicit `null` into Prisma fields; use `undefined` to skip
    // setting the column when the provider doesn't return an email/name/avatar.
    // Upsert by providerId (unique) — keep simple and safe for existing schema.
    if (!profile.providerId) {
      throw new Error('Missing providerId from OAuth profile');
    }

    const user = await this.prisma.user.upsert({
      where: { providerId: profile.providerId },
      update: {
        email: profile.email ?? undefined,
        name: profile.name ?? undefined,
        avatarUrl: profile.avatarUrl ?? undefined,
      },
      create: {
        provider: 'google',
        providerId: profile.providerId,
        // use undefined instead of null so Prisma will omit the column when absent
        email: profile.email || ' ',
        name: profile.name ?? undefined,
        avatarUrl: profile.avatarUrl ?? undefined,
      },
    });

    const payload = { sub: user.id, email: user.email ?? undefined };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: '15m',
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatarUrl,
      },
    };
  }
}
