import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaClientExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // POC: open CORS so the Next.js web app and n8n can call the API freely.
  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());

  // Catch-all first, specific Prisma filter last. Ordering is not relied upon for
  // correctness — the catch-all also maps Prisma errors — but this keeps intent clear.
  app.useGlobalFilters(
    new HttpExceptionFilter(),
    new PrismaClientExceptionFilter(),
  );

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
