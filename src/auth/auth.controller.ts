import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
interface GoogleUser {
  provider: 'google';
  providerId: string;
  email: string | null;
  name?: string | null | undefined;
  avatarUrl?: string | null | undefined;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Only OAuth2 via Google - remove traditional register/login endpoints
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async google() {
    // Passport will redirect to Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    console.log('DEBUG | req.user =', req.user);

    const { accessToken, refreshToken } = await this.authService.loginGoogle(
      req.user as GoogleUser,
    );

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      accessToken,
      refreshToken,
    });
  }
}
