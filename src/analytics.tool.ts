import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const daysBack = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d.toISOString().slice(0, 10);
  });

// Two tools, defined the MCP-Nest way (an @Injectable provider with @Tool methods).
// They mirror dummy-mcp's get_trends / get_funnel so you can compare the analytics
// captured by @posthog/mcp across the plain-SDK server and this NestJS one.
@Injectable()
export class AnalyticsTool {
  @Tool({
    name: 'get_trends',
    description: 'Return a mocked trends time series for an event over the last N days.',
    parameters: z.object({
      event: z.string().describe("Event name, e.g. 'pageview'"),
      days: z.number().int().min(1).max(90).default(7).describe('Lookback window in days'),
    }),
  })
  async getTrends({ event, days }: { event: string; days: number }) {
    console.error('get_trends', { event, days });
    const series = daysBack(days).map((date) => ({ date, value: rand(50, 5000) }));
    const result = { event, total: series.reduce((s, p) => s + p.value, 0), series };
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  @Tool({
    name: 'get_funnel',
    description: 'Return a mocked funnel conversion report for an ordered list of steps.',
    parameters: z.object({
      steps: z.array(z.string()).min(2).describe('Ordered list of event names'),
      days: z.number().int().min(1).max(90).default(7).describe('Lookback window in days'),
    }),
  })
  async getFunnel({ steps, days }: { steps: string[]; days: number }) {
    console.error('get_funnel', { steps, days });
    let count = rand(5000, 20000);
    const breakdown = steps.map((name, i) => {
      if (i > 0) count = Math.floor(count * (Math.random() * 0.5 + 0.3));
      return { step: i + 1, name, count };
    });
    const top = breakdown[0].count;
    const result = {
      days,
      overall_conversion: +(breakdown[breakdown.length - 1].count / top).toFixed(4),
      steps: breakdown.map((s) => ({ ...s, conversion_from_top: +(s.count / top).toFixed(4) })),
    };
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
}
