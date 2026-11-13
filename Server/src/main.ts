import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  app.enableCors({
    origin: [
      'http://localhost:8081',
      'http://localhost:19006',
      'http://127.0.0.1:8081',
      'http://127.0.0.1:19006',
    ],
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`Noti server listening on http://localhost:${port}`);
}
bootstrap();
