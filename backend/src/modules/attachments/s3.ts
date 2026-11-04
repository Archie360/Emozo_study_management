import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env";

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!env.s3Endpoint || !env.s3Region || !env.s3AccessKeyId || !env.s3SecretAccessKey || !env.s3Bucket) {
    throw new Error(
      "Supabase Storage is not configured — attachments cannot be uploaded until SUPABASE_S3_* env vars are set."
    );
  }
  if (!client) {
    client = new S3Client({
      endpoint: env.s3Endpoint,
      region: env.s3Region,
      credentials: { accessKeyId: env.s3AccessKeyId, secretAccessKey: env.s3SecretAccessKey },
      forcePathStyle: true,
    });
  }
  return client;
}

export async function uploadObject(key: string, body: Buffer, contentType: string) {
  await getClient().send(
    new PutObjectCommand({ Bucket: env.s3Bucket, Key: key, Body: body, ContentType: contentType })
  );
}

export async function deleteObject(key: string) {
  await getClient().send(new DeleteObjectCommand({ Bucket: env.s3Bucket, Key: key }));
}

// Files are never public — every download goes through a short-lived
// signed URL, generated on request. ResponseContentDisposition makes the
// browser save/show it under the original filename instead of the opaque
// storage key.
export async function getSignedDownloadUrl(key: string, fileName: string, expiresInSeconds = 600) {
  const command = new GetObjectCommand({
    Bucket: env.s3Bucket,
    Key: key,
    ResponseContentDisposition: `inline; filename="${fileName.replace(/"/g, "")}"`,
  });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}
