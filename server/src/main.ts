import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import cookieParser = require("cookie-parser");

const DEFAULT_PORT = "3001";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const authClientBase = process.env.AUTH_CLIENT_BASE;
  const allowedOrigins = [
    authClientBase,
    authClientBase?.includes("www.")
      ? authClientBase.replace("www.", "")
      : undefined,
    process.env.APP_DOMAIN_URL,
  ].filter(Boolean);

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "Origin",
      "X-Requested-With",
    ],
  });
  app.use(cookieParser());

  const port = process.env.PORT ?? DEFAULT_PORT;
  await app.listen(port, "0.0.0.0");

  console.log(`Server listening on http://0.0.0.0:${process.env.PORT}`);
}

bootstrap();
