// auth.controller.ts
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';

// 🔥 1. IMPORT THÊM 2 DÒNG NÀY
import { IsString, IsNotEmpty } from 'class-validator';

// 🔥 2. SỬA DTO CỦA BẠN
class GoogleLoginDto {
  @IsString() // Báo cho NestJS biết đây là 'string'
  @IsNotEmpty() // Báo cho NestJS biết trường này là bắt buộc
  idToken: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('google/callback')
  @HttpCode(200)
  async handleGoogleLoginFromNextAuth(
    @Body() body: GoogleLoginDto, // Bây giờ NestJS sẽ đọc body chính xác
  ) {
    console.log('DEBUG | Backend received body:', body); // <--- Lần này sẽ in ra idToken

    if (!body || !body.idToken) {
      console.error('Lỗi: Backend không nhận được idToken từ body');
      throw new HttpException(
        'Missing idToken in request body',
        HttpStatus.BAD_REQUEST,
      );
    }

    const { accessToken, refreshToken, user } =
      await this.authService.loginWithGoogleToken(body.idToken);

    return {
      accessToken,
      user,
    };
  }
}
