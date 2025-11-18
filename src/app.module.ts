import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { CommonModule } from './common/common.module';

import { DatabaseModule } from './database/database.module';
import { CacheModule } from './cache/cache.module';
import { AuthModule } from './api/auth/callback/auth.module';
import { AclModule } from './acl/acl.module';
import { OplogModule } from './oplog/oplog.module';
import { SnapshotModule } from './snapshot/snapshot.module';
import { PresenceModule } from './presence/presence.module';
import { CollabModule } from './collab/collab.module';
import { ExportModule } from './export/export.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthModule } from './health/health.module';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    CommonModule,
    ConfigModule,
    DatabaseModule,
    CacheModule,
    AuthModule,
    AclModule,
    OplogModule,
    SnapshotModule,
    PresenceModule,
    CollabModule,
    ExportModule,
    NotificationsModule,
    HealthModule,
    DocumentsModule,
  ],
})
export class AppModule {}
