import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { GoogleAuthCodeDto } from './dto/google-auth-code.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterLocalDto } from './dto/register-local.dto';
import { LoginLocalDto } from './dto/login-local.dto';
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

  private setRefreshCookie(res: Response, token: string) {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  @Post('google/code')
  async loginWithGoogleCode(
    @Body() dto: GoogleAuthCodeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginWithGoogleCode(dto.code);
    this.setRefreshCookie(res, result.refreshToken);
    return result;
  }

  @Post('register')
  async register(
    @Body() dto: RegisterLocalDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.registerLocal(dto);
    this.setRefreshCookie(res, result.refreshToken);
    return result;
  }

  @Post('login')
  async login(
    @Body() dto: LoginLocalDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginLocal(dto);
    this.setRefreshCookie(res, result.refreshToken);
    return result;
  }

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
    this.setRefreshCookie(res, refreshToken);

    return res.json({
      accessToken,
      refreshToken,
    });
  }

  @Post('refresh')
  async refreshTokens(
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.refreshTokens(dto.refreshToken);
    this.setRefreshCookie(res, result.refreshToken);
    return result;
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('refresh_token', { path: '/auth/refresh' });
    return { success: true };
  }
}
