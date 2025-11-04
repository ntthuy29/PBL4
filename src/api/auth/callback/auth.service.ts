import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library'; // <-- THÊM THƯ VIỆN NÀY

@Injectable()
export class AuthService {
  // Khởi tạo Google Client
  private googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {
    // Khởi tạo Google client với Client ID của bạn
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  /**
   * HÀM MỚI: Dùng để xác thực idToken từ NextAuth
   * Thay thế cho hàm loginGoogle cũ.
   */
  async loginWithGoogleToken(idToken: string) {
    let googleProfilePayload;

    // 1. Xác thực idToken với server của Google
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: idToken,
        audience: process.env.GOOGLE_CLIENT_ID, // So khớp Client ID
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new Error('Invalid Google token');
      }
      googleProfilePayload = payload;
    } catch (error) {
      console.error('Google ID Token verification failed:', error);
      throw new HttpException('Invalid Google Token', HttpStatus.UNAUTHORIZED);
    }

    // 2. Dùng logic upsert CŨ của bạn với thông tin MỚI
    const {
      sub: providerId, // 'sub' là ID duy nhất của Google
      email,
      name,
      picture: avatarUrl,
    } = googleProfilePayload;

    if (!providerId) {
      throw new HttpException(
        'Missing providerId (sub) from Google profile',
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = await this.prisma.user.upsert({
      where: { providerId: providerId }, // 'sub' là ID duy nhất
      update: {
        email: email ?? undefined,
        name: name ?? undefined,
        avatarUrl: avatarUrl ?? undefined,
      },
      create: {
        provider: 'google',
        providerId: providerId,
        email: email || ' ', // Giữ nguyên logic của bạn
        name: name ?? undefined,
        avatarUrl: avatarUrl ?? undefined,
      },
    });

    // 3. Tạo token (Giữ nguyên logic của bạn)
    const payload = { sub: user.id, email: user.email ?? undefined };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: '15m',
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    // 4. Trả về dữ liệu cho Controller
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

  /*
   * HÀM CŨ: (loginGoogle)
   * Không còn cần thiết nữa vì NextAuth đã xử lý việc lấy profile.
   * Bạn có thể xóa nó đi.
   */
  // async loginGoogle(profile: ...) { ... }
}
