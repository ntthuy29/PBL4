// strategies/google.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly config: ConfigService) {
    super({
      clientID: thisRequired(config.get<string>('GOOGLE_CLIENT_ID')),
      clientSecret: thisRequired(config.get<string>('GOOGLE_CLIENT_SECRET')),
      callbackURL: thisRequired(config.get<string>('GOOGLE_CALLBACK_URL')),
      scope: ['profile', 'email'], // ⭐ bắt buộc
      // passReqToCallback: true,    // chỉ bật nếu bạn muốn nhận req trong validate
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<any> {
    const user = {
      provider: 'google',
      providerId: profile.id,
      email: profile.emails?.[0]?.value ?? undefined,
      name: profile.displayName ?? '',
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };
    done(null, user);
  }
}

// helper nhỏ để tránh undefined từ ConfigService (giúp TS yên tâm)
function thisRequired<T>(v: T | undefined): T {
  if (v == null) throw new Error('Missing required env for Google OAuth');
  return v;
}
