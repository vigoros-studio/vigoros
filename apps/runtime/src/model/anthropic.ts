import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { ModelAdapter, TurnRequest, TurnResult } from './adapter'

/**
 * Structured output on every call. Thinking is adaptive by default on these models;
 * depth is controlled with effort. Server-side fallback is on for refusal categories.
 */
export const anthropicAdapter = (apiKey: string): ModelAdapter => {
  const client = new Anthropic({ apiKey })
  return {
    name: 'anthropic',
    async complete<T>(req: TurnRequest<T>): Promise<TurnResult<T>> {
      const params = {
        model: req.model,
        max_tokens: req.maxOutputTokens,
        output_config: { effort: req.effort, format: zodOutputFormat(req.schema) },
        system: [
          {
            type: 'text' as const,
            text: req.system.stable,
            cache_control: { type: 'ephemeral' as const, ttl: '1h' as const },
          },
          { type: 'text' as const, text: req.system.volatile },
        ],
        messages: [{ role: 'user' as const, content: req.user }],
        ...(req.webSearch
          ? {
              tools: [
                { type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: 6 },
              ],
            }
          : {}),
      }
      const res = await client.messages.parse(params)
      if (res.stop_reason === 'refusal')
        throw new Error(`model refused: ${res.stop_details?.category ?? 'unknown'}`)
      if (!res.parsed_output) throw new Error(`model returned no parseable ${req.schemaName}`)
      return {
        output: res.parsed_output,
        usage: {
          inputTokens: res.usage.input_tokens,
          outputTokens: res.usage.output_tokens,
          cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
          cacheWriteTokens: res.usage.cache_creation_input_tokens ?? 0,
        },
        request: { ...params, system: '[cached role prompt omitted]', messages: params.messages },
        response: res.content,
        stopReason: res.stop_reason ?? 'end_turn',
      }
    },
  }
}
