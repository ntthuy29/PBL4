import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth/jwt-auth.guard';
import { WsJwtAuthGuard } from './guards/ws-jwt-auth/ws-jwt-auth.guard';

@Module({
  providers: [JwtAuthGuard, WsJwtAuthGuard],
  exports: [JwtAuthGuard, WsJwtAuthGuard],
})
export class CommonModule {}
