import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSend = vi.fn();
vi.mock('@aws-sdk/client-s3', () => {
  const S3Client = vi.fn().mockImplementation(() => ({ send: mockSend }));
  const PutObjectCommand = vi.fn().mockImplementation((input) => ({ _type: 'Put', ...input }));
  const GetObjectCommand = vi.fn().mockImplementation((input) => ({ _type: 'Get', ...input }));
  const HeadObjectCommand = vi.fn().mockImplementation((input) => ({ _type: 'Head', ...input }));
  const DeleteObjectCommand = vi.fn().mockImplementation((input) => ({ _type: 'Delete', ...input }));
  return { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand };
});

import { createStorageClient } from './storage.js';

const config = {
  s3Endpoint: 'http://minio:9000',
  s3Bucket: 'promaly',
  s3Region: 'us-east-1',
  s3AccessKeyId: 'test-key',
  s3SecretAccessKey: 'test-secret',
  s3ForcePathStyle: true,
  maxAttachmentBytes: 26_214_400,
} as unknown as Parameters<typeof createStorageClient>[0];

describe('createStorageClient', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it('putObject sends PutObjectCommand with correct fields', async () => {
    mockSend.mockResolvedValue({});
    const client = createStorageClient(config);
    const body = Readable.from(['data']);
    await client.putObject('ws/file.pdf', body, 'application/pdf', 4);
    expect(mockSend).toHaveBeenCalledOnce();
    const cmd = mockSend.mock.calls[0]![0] as Record<string, unknown>;
    expect(cmd.Bucket).toBe('promaly');
    expect(cmd.Key).toBe('ws/file.pdf');
    expect(cmd.ContentType).toBe('application/pdf');
    expect(cmd.ContentLength).toBe(4);
  });

  it('getObjectStream returns Body from GetObjectCommand', async () => {
    const stream = Readable.from(['hello']);
    mockSend.mockResolvedValue({ Body: stream });
    const client = createStorageClient(config);
    const result = await client.getObjectStream('ws/file.pdf');
    expect(result).toBe(stream);
    expect(mockSend).toHaveBeenCalledOnce();
    const cmd = mockSend.mock.calls[0]![0] as Record<string, unknown>;
    expect(cmd.Key).toBe('ws/file.pdf');
  });

  it('headObject returns metadata from HeadObjectCommand', async () => {
    mockSend.mockResolvedValue({ ContentLength: 1024, ContentType: 'image/png' });
    const client = createStorageClient(config);
    const meta = await client.headObject('ws/img.png');
    expect(meta).toEqual({ contentLength: 1024, contentType: 'image/png' });
  });

  it('headObject returns 0 bytes when ContentLength is absent', async () => {
    mockSend.mockResolvedValue({ ContentType: 'text/plain' });
    const client = createStorageClient(config);
    const meta = await client.headObject('ws/note.txt');
    expect(meta.contentLength).toBe(0);
  });

  it('deleteObject sends DeleteObjectCommand', async () => {
    mockSend.mockResolvedValue({});
    const client = createStorageClient(config);
    await client.deleteObject('ws/old.pdf');
    const cmd = mockSend.mock.calls[0]![0] as Record<string, unknown>;
    expect(cmd.Key).toBe('ws/old.pdf');
    expect(cmd.Bucket).toBe('promaly');
  });
});
