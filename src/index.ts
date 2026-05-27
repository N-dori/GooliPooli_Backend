import 'dotenv/config';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';

const app = createApp();

app.listen(env.API_PORT, env.API_HOST, () => {
  logger.info({ port: env.API_PORT, host: env.API_HOST }, 'Goolipooli API listening');
});
