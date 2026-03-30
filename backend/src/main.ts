import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api/v1', {
    exclude: ['/socket.io/(.*)'],
  });

  app.useWebSocketAdapter(new IoAdapter(app));

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(` Amboras API running on http://localhost:${port}`);
  console.log(` WebSocket gateway available at ws://localhost:${port}/analytics`);
}

bootstrap();
