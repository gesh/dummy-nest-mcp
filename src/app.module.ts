import { Module } from '@nestjs/common';
import { McpModule, McpTransportType } from '@rekog/mcp-nest';
import { AnalyticsTool } from './analytics.tool';
import { instrumentationMutator } from './posthog';

@Module({
  imports: [
    McpModule.forRoot({
      name: 'dummy-nest-mcp',
      version: '0.1.0',
      transport: McpTransportType.STREAMABLE_HTTP,
      streamableHttp: { enableJsonResponse: true },
      logging: { level: ['log', 'error', 'warn', 'debug'] },
      // The integration under test: hand the underlying SDK McpServer to @posthog/mcp.
      serverMutator: instrumentationMutator,
    }),
  ],
  providers: [AnalyticsTool],
})
export class AppModule {}
