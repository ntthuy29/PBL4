import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtModule } from '@nestjs/jwt/dist/jwt.module';
import { PrismaModule } from 'prisma/prisma.module';
import { PassportModule } from '@nestjs/passport/dist/passport.module';
import { ConfigModule } from '@nestjs/config/dist/config.module';

@Module({
  imports: [
    PrismaModule,
    ConfigModule.forRoot(),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy],
})
export class AuthModule {}
