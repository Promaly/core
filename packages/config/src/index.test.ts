import { describe, expect, it } from 'vitest';
import { loadConfig } from './index.js';

describe('loadConfig', () => {
  it('provides safe development defaults', () => {
    expect(loadConfig({})).toEqual({
      nodeEnv: 'development',
      host: '0.0.0.0',
      port: 3000,
      databaseUrl: undefined,
      s3Endpoint: undefined,
      logLevel: 'info',
    });
  });

  it('rejects an invalid port', () => {
    expect(() => loadConfig({ PORT: '70000' })).toThrow('Invalid configuration');
  });
});
