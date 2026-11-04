import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required("JWT_SECRET", "dev-secret-do-not-use-in-production"),
  databaseUrl: required("DATABASE_URL"),
  frontendUrl: process.env.FRONTEND_URL,
  // Supabase Storage, accessed via its S3-compatible API. Also optional at
  // startup — attachment endpoints fail with a clear error until set.
  s3Endpoint: process.env.SUPABASE_S3_ENDPOINT,
  s3Region: process.env.SUPABASE_S3_REGION,
  s3AccessKeyId: process.env.SUPABASE_S3_ACCESS_KEY_ID,
  s3SecretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY,
  s3Bucket: process.env.SUPABASE_S3_BUCKET,
};
