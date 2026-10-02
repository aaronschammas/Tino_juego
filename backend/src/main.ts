process.env.TZ = 'America/Argentina/Buenos_Aires';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  // rawBody habilita el acceso al cuerpo original de la request, necesario para
  // validar la firma con la que Meta firma los webhooks de WhatsApp.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const corsOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
    : [];

  app.enableCors({
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Corrección: Fallback de seguridad al puerto 8080
  const port = process.env.PORT || 8080;

  // Vinculación estricta a todas las interfaces de red para Cloud Run
  await app.listen(port, '0.0.0.0');
  console.log(
    `🚀 NestJS Backend ejecutándose de forma segura en 0.0.0.0:${port}`,
  );
}
bootstrap();
