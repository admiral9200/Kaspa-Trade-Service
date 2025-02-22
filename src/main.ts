import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as WebSocket from 'websocket';
import { SERVICE_TYPE } from './modules/backend/constants';
import { ServiceTypeEnum } from './modules/core/enums/service-type.enum';
import { AppConfigService } from './modules/core/modules/config/app-config.service';
import { AppGlobalLoggerService } from './modules/core/modules/logger/app-global-logger.service';
import { AppModule } from './app.module';
import { CliJobManager } from './modules/backend/cli-job-manager/cli-job.manager';
import { ImportantPromisesManager } from './modules/backend/important-promises-manager/important-promises-manager';
import mongoose from 'mongoose';

// Needed for Wasm
globalThis.WebSocket = WebSocket.w3cwebsocket;

async function bootstrap() {
  let app = null;

  if (SERVICE_TYPE == ServiceTypeEnum.API) {
    console.log('starting api instance');

    app = await NestFactory.create(AppModule);

    const appConfigService: AppConfigService = app.get(AppConfigService);

    let allowedOrigins = ['https://api.kaspiano.com'];

    if (!appConfigService.isProd) {
      allowedOrigins = ['https://dev-api.kaspiano.com', 'http://localhost:8080'];
    }

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

    const port = appConfigService.getServicePort || 3000;

    if (appConfigService.isLocalEnv) {
      mongoose.set('debug', true);
    }

    console.log(`app running on port:::`, port);
    await app.listen(port);
  } else if (SERVICE_TYPE == ServiceTypeEnum.CRON || SERVICE_TYPE == ServiceTypeEnum.JOB) {
    console.log(`starting ${SERVICE_TYPE} instance`);

    app = await NestFactory.createApplicationContext(AppModule);

    const appConfigService: AppConfigService = app.get(AppConfigService);
    if (appConfigService.isLocalEnv) {
      mongoose.set('debug', true);
    }
  }

  const logError = async (error: any) => {
    console.error('UNCAUGHT EXEPTION OCCORED: ', error);
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

      const shutdownTimeout = setTimeout(
        () => {
          console.log('Graceful shutdown timed out. Forcing exit.');
          process.exit(1);
        },
        60 * 60 * 1000,
      ); // 1 hour timeout

      try {
        ImportantPromisesManager.closeApplication();
        await ImportantPromisesManager.waitForAllPromisesToResolveIfAny();
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

  if (SERVICE_TYPE == ServiceTypeEnum.JOB) {
    const jobManager = app.get(CliJobManager);

    let hasError = false;
    try {
      await jobManager.handleJob();
    } catch (error) {
      hasError = true;
      console.error(error);
    }

    await app.close();

    process.exit(hasError ? 1 : 0);
  }
}

bootstrap();
