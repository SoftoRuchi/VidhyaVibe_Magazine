import type { Readable } from 'stream';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env, Logger } from '@magazine/config';

export function createS3Adapter(env: Env, ctx: { logger: Logger }) {
  const client = new S3Client({
    endpoint: env.STORAGE_ENDPOINT || undefined,
    region: 'us-east-1',
    credentials:
      env.STORAGE_ACCESS_KEY && env.STORAGE_SECRET_KEY
        ? { accessKeyId: env.STORAGE_ACCESS_KEY, secretAccessKey: env.STORAGE_SECRET_KEY }
        : undefined,
    forcePathStyle: true,
  } as any);

  return {
    async upload(key: string, buffer: Buffer, contentType?: string) {
      const bucket = env.STORAGE_BUCKET || 'magazine';
      const cmd = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType || 'application/octet-stream',
      });
      await client.send(cmd);
      const url = `${env.STORAGE_ENDPOINT?.replace(/\/$/, '') || ''}/${bucket}/${key}`;
      return { url, key };
    },
    async get(key: string) {
      const bucket = env.STORAGE_BUCKET || 'magazine';
      const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
      const res: any = await client.send(cmd);
      return res.Body as Readable;
    },
    async presignUpload(key: string, contentType = 'application/octet-stream', expiresSec = 900) {
      const bucket = env.STORAGE_BUCKET || 'magazine';
      const cmd = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      });
      const url = await getSignedUrl(client as any, cmd, { expiresIn: expiresSec });
      return { url, key };
    },
    async presignGet(key: string, expiresSec = 900) {
      const bucket = env.STORAGE_BUCKET || 'magazine';
      const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
      const url = await getSignedUrl(client as any, cmd, { expiresIn: expiresSec });
      return { url, key };
    },
  };
}
