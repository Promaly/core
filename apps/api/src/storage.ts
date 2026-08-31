import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import type { AppConfig } from '@promaly/config';

export type StorageClient = ReturnType<typeof createStorageClient>;

export function createStorageClient(config: AppConfig) {
  const clientConfig = {
    region: config.s3Region,
    forcePathStyle: config.s3ForcePathStyle,
    ...(config.s3Endpoint ? { endpoint: config.s3Endpoint } : {}),
    ...(config.s3AccessKeyId && config.s3SecretAccessKey
      ? {
          credentials: {
            accessKeyId: config.s3AccessKeyId,
            secretAccessKey: config.s3SecretAccessKey,
          },
        }
      : {}),
  };
  const client = new S3Client(clientConfig);
  const bucket = config.s3Bucket;

  return {
    async putObject(
      key: string,
      body: Readable,
      contentType: string,
      contentLength: number,
    ): Promise<void> {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ContentLength: contentLength,
        }),
      );
    },

    async getObjectStream(key: string): Promise<Readable> {
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return response.Body as Readable;
    },

    async headObject(
      key: string,
    ): Promise<{ contentLength: number; contentType: string | undefined }> {
      const response = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return { contentLength: response.ContentLength ?? 0, contentType: response.ContentType };
    },

    async deleteObject(key: string): Promise<void> {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}
