import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as WebSocket from 'websocket';
import { AppModule } from './app.module';
import { AppConfigService } from './modules/core/modules/config/app-config.service';
import { ServiceTypeEnum } from './modules/core/enums/service-type.enum';
import { CronAppModule } from './cron-app.module';
import { SERVICE_TYPE } from './modules/backend/constants';
import { AppGlobalLoggerService } from './modules/core/modules/logger/app-global-logger.service';

// Needed for Wasm
globalThis.WebSocket = WebSocket.w3cwebsocket;

async function bootstrap() {
  let app = null;

  if (SERVICE_TYPE == ServiceTypeEnum.API) {
    app = await NestFactory.create(AppModule);
    const allowedOrigins = ['https://api.kaspiano.com', 'https://dev-api.kaspiano.com', 'http://localhost:8080'];

    app.enableCors({
      origin: (origin, callback) => {
        // Allow requests with no origin like mobile apps or curl requests
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }, // Replace with your frontend domain
      credentials: true, // Allow sending cookies with requests
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Specify allowed methods (optional)
      allowedHeaders: 'Content-Type, Authorization, Cookie', // Specify allowed headers (optional)
      exposedHeaders: 'Set-Cookie',
    });

    app.useGlobalPipes(
      new ValidationPipe({
        // Show error messages
        disableErrorMessages: false,
        // If user send extra data from the dto the data will be stripped
        whitelist: true,
        // To enable auto-transformation, set transform to true
        transform: true,
      }),
    );

    app.use(helmet());
    app.use(cookieParser());

    const appConfigService = app.get(AppConfigService);
    const port = appConfigService.getServicePort || 3000;

    console.log(`app running on port:::`, port);
    await app.listen(port);
  } else if (SERVICE_TYPE == ServiceTypeEnum.CRON) {
    app = await NestFactory.createApplicationContext(CronAppModule);
  }

  const logError = async (error: any) => {
    const logger = app.get(AppGlobalLoggerService);

    logger.error('UNCAUGHT EXEPTION OCCORED');
    logger.error(error, error?.stack, error?.meta);
  };

  process.on('unhandledRejection', logError);
  process.on('unhandledException', logError);
  process.on('uncaughtException', logError);

  ['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.on(signal, async () => {
      console.log(`${signal} received. Starting graceful shutdown.`);

      const shutdownTimeout = setTimeout(() => {
        console.log('Graceful shutdown timed out. Forcing exit.');
        process.exit(1);
      }, 300_000); // 5 minutes timeout

      try {
        await app.close();

        console.log('Graceful shutdown completed.');
        clearTimeout(shutdownTimeout);
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        clearTimeout(shutdownTimeout);
      }
    });
  });
}

bootstrap();

setTimeout(() => {
  throw new Error('Test error');
}, 4000);

new Promise(() =>
  setTimeout(() => {
    throw new Error('Test error 2');
  }, 5000),
);
