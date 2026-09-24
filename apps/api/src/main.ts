import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { isOriginAllowed, isSwaggerEnabled } from './common/security/environment-security.util';

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security Headers
  app.use(helmet());

  // Cookie Parser
  app.use(cookieParser());

  // CORS configuration — production AND staging only allow the explicitly
  // configured trusted origins (CORS_ORIGINS). Only 'development' gets a
  // permissive fallback, for local frontend dev without needing
  // CORS_ORIGINS set. There is no "any non-production environment" bypass
  // anymore — staging previously fell through that check unintentionally.
  // See common/security/environment-security.util.ts for the decision
  // logic (extracted so it's unit-testable independent of bootstrapping
  // the whole app).
  app.enableCors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin, process.env.NODE_ENV, process.env.CORS_ORIGINS)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-load-test-auth'],
  });

  // Global Interceptors & Filters
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger Documentation — never exposed in production. Available in
  // staging/development for controlled testing.
  const swaggerEnabled = isSwaggerEnabled(process.env.NODE_ENV);
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('ONGC Navratri QR Entry Control API')
      .setDescription(
        'Production-grade NestJS backend for ONGC Navratri QR scanning, gate control, registrations, and traffic testing.',
      )
      .setVersion('2.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`[ONGC Entry Engine] NestJS backend running on http://localhost:${port}`);
  if (swaggerEnabled) {
    console.log(`[ONGC Entry Engine] Swagger documentation at http://localhost:${port}/api/docs`);
  }
}

bootstrap();
