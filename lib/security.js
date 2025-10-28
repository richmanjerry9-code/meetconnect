import helmet from "helmet";
import rateLimit from "express-rate-limit";

export const applySecurity = (app) => {
  app.use(helmet());
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://www.google.com/recaptcha/"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
      },
    })
  );

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests, try again later.",
  });
  app.use(limiter);
};
