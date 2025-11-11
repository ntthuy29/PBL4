import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// ✅ ĐÚNG - Runtime imports
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterLocalDto } from './dto/register-local.dto';
import { LoginLocalDto } from './dto/login-local.dto';

type GoogleTokensResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
};

type GoogleUserInfo = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async registerLocal(dto: RegisterLocalDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashed,
        name: dto.name ?? undefined,
        provider: 'local',
      },
    });

    const tokens = await this.issueTokens(user.id, user.email);
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatarUrl,
      },
    };
  }

  async loginLocal(dto: LoginLocalDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const matches = await bcrypt.compare(dto.password, user.password);
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokens(user.id, user.email);
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatarUrl,
      },
    };
  }

  async loginWithGoogleCode(code: string) {
    if (!code) {
      throw new BadRequestException('Missing Google authorization code');
    }

    const tokens = await this.exchangeGoogleCode(code);
    if (!tokens.access_token) {
      throw new UnauthorizedException('Google did not return an access token');
    }

    const profile = await this.fetchGoogleProfile(tokens.access_token);
    return this.loginGoogle({
      provider: 'google',
      providerId: profile.sub,
      email: profile.email ?? null,
      name: profile.name ?? profile.email ?? null,
      avatarUrl: profile.picture ?? null,
    });
  }

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

    const tokens = await this.issueTokens(user.id, user.email);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatarUrl,
      },
    };
  }

  async refreshTokens(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const tokens = await this.issueTokens(user.id, user.email);
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatarUrl,
      },
    };
  }

  private async exchangeGoogleCode(code: string): Promise<GoogleTokensResponse> {
    const params = new URLSearchParams({
      code,
      client_id: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      client_secret: this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      redirect_uri:
        this.config.get<string>('GOOGLE_REDIRECT_URI') ?? 'postmessage',
      grant_type: 'authorization_code',
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new UnauthorizedException('Failed to exchange Google auth code');
    }

    return (await response.json()) as GoogleTokensResponse;
  }

  private async fetchGoogleProfile(
    accessToken: string,
  ): Promise<GoogleUserInfo> {
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      throw new UnauthorizedException('Failed to fetch Google profile');
    }

    const profile = (await response.json()) as GoogleUserInfo;
    if (!profile.sub) {
      throw new UnauthorizedException('Google profile missing subject id');
    }

    return profile;
  }

  private async issueTokens(userId: string, email: string | null) {
    const payload = { sub: userId, email: email ?? undefined };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
