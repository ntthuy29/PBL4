// main.ts (TRONG DỰ ÁN NESTJS)
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import * as express from 'express'; // Dùng * as

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const prisma = app.get(PrismaService);

  // 1. CORS LÊN TRƯỚC TIÊN
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // 2. JSON PARSER (ĐỂ ĐỌC BODY) LÊN TRƯỚC HELMET
  app.use(express.json({ limit: '50mb' }));

  // 3. HELMET
  app.use(helmet());

  // 4. CÁC THỨ CÒN LẠI
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // ... (Swagger config)
  const config = new DocumentBuilder()
    .setTitle('My Nest API')
    .setDescription('API docs')
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 Server is running on http://localhost:${port}`);
  console.log(`📘 Swagger docs at http://localhost:${port}/docs`);
}
bootstrap();
