import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { NodeSDK } from '@opentelemetry/sdk-node';
import type { AppConfig } from '@promaly/config';

export function startOpenTelemetry(config: AppConfig): (() => Promise<void>) | undefined {
  if (!config.otelTracesEnabled || !config.otelExporterOtlpEndpoint) {
    return undefined;
  }

  const sdk = new NodeSDK({
    serviceName: config.otelServiceName,
    traceExporter: new OTLPTraceExporter({ url: config.otelExporterOtlpEndpoint }),
    instrumentations: [getNodeAutoInstrumentations()],
  });
  sdk.start();
  return () => sdk.shutdown();
}
