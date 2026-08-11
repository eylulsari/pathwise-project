import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  // Security headers + cookie parsing (refresh token lives in an httpOnly cookie).
  app.use(helmet());
  app.use(cookieParser());

  // All routes are served under /api
  app.setGlobalPrefix('api');

  // Global DTO validation — whitelist strips unknown props, forbid rejects them.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Consistent error envelope for every thrown error.
  app.useGlobalFilters(new AllExceptionsFilter());

  const origins = (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());
  app.enableCors({ origin: origins, credentials: true });

  // PORT first: most managed hosts (Render, Heroku, Fly) assign it and expect
  // the process to bind to it. BACKEND_PORT stays for docker-compose.
  const port = config.get<number>('PORT') ?? config.get<number>('BACKEND_PORT') ?? 3000;
  await app.listen(port);
  Logger.log(`🚀 Pathwise API ready at http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap();
