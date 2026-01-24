/**
 * V2 Resort - Distributed Tracing Service
 * OpenTelemetry-based distributed tracing for request flow visibility
 */

import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis-4';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import {
  trace,
  context,
  SpanKind,
  SpanStatusCode,
  propagation,
  Span,
  Tracer,
} from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';

// Configuration
const SERVICE_NAME = process.env.SERVICE_NAME || 'v2resort-backend';
const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.0.0';
const OTEL_EXPORTER_URL = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';
const ENVIRONMENT = process.env.NODE_ENV || 'development';

let tracerProvider: NodeTracerProvider | null = null;
let tracer: Tracer | null = null;

/**
 * Initialize distributed tracing
 */
export function initializeTracing(): void {
  if (tracerProvider) {
    console.log('[Tracing] Already initialized');
    return;
  }

  // Create resource describing this service
  const resource = resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
    [SemanticResourceAttributes.SERVICE_VERSION]: SERVICE_VERSION,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: ENVIRONMENT,
  });

  // Create tracer provider
  tracerProvider = new NodeTracerProvider({ resource: resource as any });

  // Configure exporter
  const exporter = new OTLPTraceExporter({
    url: OTEL_EXPORTER_URL,
    headers: {
      'x-api-key': process.env.OTEL_API_KEY || '',
    },
  });

  // Use batch processor in production, simple in development
  const spanProcessor = ENVIRONMENT === 'production'
    ? new BatchSpanProcessor(exporter as any, {
        maxQueueSize: 1000,
        maxExportBatchSize: 100,
        scheduledDelayMillis: 5000,
      })
    : new SimpleSpanProcessor(exporter as any);

  (tracerProvider as any).addSpanProcessor(spanProcessor);

  // Set up propagation (W3C Trace Context)
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  // Register the provider globally
  tracerProvider.register();

  // Register automatic instrumentations
  registerInstrumentations({
    tracerProvider,
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (request) => {
          // Ignore health checks and static files
          const url = request.url || '';
          return url.includes('/health') || url.includes('/static/');
        },
        requestHook: (span, request) => {
          // Add custom attributes
          span.setAttribute('http.request_id', (request as any).headers?.['x-request-id'] || '');
          span.setAttribute('http.correlation_id', (request as any).headers?.['x-correlation-id'] || '');
        },
      }),
      new ExpressInstrumentation({
        ignoreLayers: ['/health', '/metrics'],
        requestHook: (span, info) => {
          span.setAttribute('express.route', info.route || 'unknown');
        },
      }),
      new PgInstrumentation({
        enhancedDatabaseReporting: true,
      }),
      new RedisInstrumentation({
        dbStatementSerializer: (cmdName, cmdArgs) => {
          // Don't log full Redis commands with sensitive data
          return `${cmdName} [${cmdArgs.length} args]`;
        },
      }),
    ],
  });

  tracer = trace.getTracer(SERVICE_NAME, SERVICE_VERSION);

  console.log(`[Tracing] Initialized for ${SERVICE_NAME} v${SERVICE_VERSION}`);
  console.log(`[Tracing] Exporting to ${OTEL_EXPORTER_URL}`);
}

/**
 * Get the tracer instance
 */
export function getTracer(): Tracer {
  if (!tracer) {
    initializeTracing();
  }
  return tracer || trace.getTracer(SERVICE_NAME);
}

/**
 * Create a new span for a custom operation
 */
export function createSpan(
  name: string,
  options: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
    parent?: Span;
  } = {}
): Span {
  const t = getTracer();
  
  const spanOptions: any = {
    kind: options.kind || SpanKind.INTERNAL,
    attributes: options.attributes,
  };

  if (options.parent) {
    const ctx = trace.setSpan(context.active(), options.parent);
    return t.startSpan(name, spanOptions, ctx);
  }

  return t.startSpan(name, spanOptions);
}

/**
 * Wrap an async function with tracing
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
  } = {}
): Promise<T> {
  const span = createSpan(name, options);

  try {
    const result = await context.with(
      trace.setSpan(context.active(), span),
      () => fn(span)
    );
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error: any) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Wrap a sync function with tracing
 */
export function withSpanSync<T>(
  name: string,
  fn: (span: Span) => T,
  options: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
  } = {}
): T {
  const span = createSpan(name, options);

  try {
    const result = fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error: any) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Add event to current span
 */
export function addSpanEvent(
  name: string,
  attributes?: Record<string, string | number | boolean>
): void {
  const currentSpan = trace.getSpan(context.active());
  if (currentSpan) {
    currentSpan.addEvent(name, attributes);
  }
}

/**
 * Add attributes to current span
 */
export function addSpanAttributes(
  attributes: Record<string, string | number | boolean>
): void {
  const currentSpan = trace.getSpan(context.active());
  if (currentSpan) {
    currentSpan.setAttributes(attributes);
  }
}

/**
 * Get current trace ID
 */
export function getCurrentTraceId(): string | null {
  const currentSpan = trace.getSpan(context.active());
  if (!currentSpan) return null;

  const spanContext = currentSpan.spanContext();
  return spanContext.traceId;
}

/**
 * Get current span ID
 */
export function getCurrentSpanId(): string | null {
  const currentSpan = trace.getSpan(context.active());
  if (!currentSpan) return null;

  const spanContext = currentSpan.spanContext();
  return spanContext.spanId;
}

/**
 * Express middleware for manual span management
 */
export function tracingMiddleware() {
  return (req: any, res: any, next: any) => {
    const t = getTracer();

    const span = t.startSpan(`HTTP ${req.method} ${req.path}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': req.method,
        'http.url': req.originalUrl,
        'http.target': req.path,
        'http.host': req.hostname,
        'http.user_agent': req.headers['user-agent'] || 'unknown',
        'user.id': req.user?.id || 'anonymous',
      },
    });

    // Store span and trace IDs on request
    req.span = span;
    req.traceId = span.spanContext().traceId;
    req.spanId = span.spanContext().spanId;

    // Add trace ID to response headers
    res.setHeader('X-Trace-Id', req.traceId);

    // Run in span context
    context.with(trace.setSpan(context.active(), span), () => {
      // Capture response
      const originalEnd = res.end;
      res.end = function (...args: any[]) {
        span.setAttribute('http.status_code', res.statusCode);

        if (res.statusCode >= 400) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${res.statusCode}`,
          });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }

        span.end();
        return originalEnd.apply(this, args);
      };

      next();
    });
  };
}

/**
 * Create traces for specific operations
 */
export const traces = {
  /**
   * Trace a database query
   */
  async dbQuery<T>(
    operation: string,
    table: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return withSpan(`db.${operation}`, async (span) => {
      span.setAttribute('db.system', 'postgresql');
      span.setAttribute('db.operation', operation);
      span.setAttribute('db.table', table);
      return fn();
    }, { kind: SpanKind.CLIENT });
  },

  /**
   * Trace an external API call
   */
  async externalApi<T>(
    service: string,
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return withSpan(`external.${service}.${operation}`, async (span) => {
      span.setAttribute('peer.service', service);
      span.setAttribute('rpc.method', operation);
      return fn();
    }, { kind: SpanKind.CLIENT });
  },

  /**
   * Trace a cache operation
   */
  async cache<T>(
    operation: 'get' | 'set' | 'delete',
    key: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return withSpan(`cache.${operation}`, async (span) => {
      span.setAttribute('db.system', 'redis');
      span.setAttribute('db.operation', operation);
      span.setAttribute('cache.key', key.split(':')[0]); // Only log key prefix
      return fn();
    }, { kind: SpanKind.CLIENT });
  },

  /**
   * Trace business logic
   */
  async business<T>(
    domain: string,
    operation: string,
    fn: (span: Span) => Promise<T>
  ): Promise<T> {
    return withSpan(`${domain}.${operation}`, fn, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'business.domain': domain,
        'business.operation': operation,
      },
    });
  },
};

/**
 * Shutdown tracing
 */
export async function shutdownTracing(): Promise<void> {
  if (tracerProvider) {
    await tracerProvider.shutdown();
    tracerProvider = null;
    tracer = null;
    console.log('[Tracing] Shutdown complete');
  }
}

// Auto-initialize in production
if (process.env.NODE_ENV === 'production' && process.env.OTEL_ENABLED === 'true') {
  initializeTracing();
}
