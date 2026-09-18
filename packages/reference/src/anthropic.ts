import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { sha256Hex } from '@vigoros/domain'
import { SYSTEM_PROMPT, formatQuestions } from './prompt'
import { AnswerBatchSchema, ProviderError, type ForecastProvider, type ForecastResult, type PromptQuestion } from './types'

export interface AnthropicProviderOptions {
  apiKey?: string
  /** Exact model id, e.g. "claude-opus-5". Part of the participant's public config. */
  model: string
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  client?: Anthropic
}

/**
 * Deliberately no `fallbacks`: if the model refuses, the run fails and is recorded as such.
 * A benchmark record must be the named model's own output.
 */
export class AnthropicProvider implements ForecastProvider {
  readonly id = 'anthropic'
  readonly model: string
  private readonly client: Anthropic
  private readonly effort: NonNullable<AnthropicProviderOptions['effort']>

  constructor(opts: AnthropicProviderOptions) {
    this.model = opts.model
    this.effort = opts.effort ?? 'medium'
    this.client = opts.client ?? new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {})
  }

  async forecast(questions: readonly PromptQuestion[], asOf: string): Promise<ForecastResult> {
    const user = formatQuestions(questions, asOf)
    const requestHash = await sha256Hex(`${this.model}|${SYSTEM_PROMPT}|${user}`)
    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 16000,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        output_config: { format: zodOutputFormat(AnswerBatchSchema), effort: this.effort },
        messages: [{ role: 'user', content: user }],
      })
      if (response.stop_reason === 'refusal') {
        throw new ProviderError(this.id, 'refusal', response.stop_details?.explanation ?? 'refused')
      }
      if (!response.parsed_output) throw new ProviderError(this.id, 'invalid_output', 'unparseable output')
      const raw = JSON.stringify(response.parsed_output)
      return {
        answers: response.parsed_output.answers,
        usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
        requestHash,
        responseHash: await sha256Hex(raw),
      }
    } catch (e) {
      if (e instanceof ProviderError) throw e
      if (e instanceof Anthropic.RateLimitError) throw new ProviderError(this.id, 'rate_limit', e.message)
      if (e instanceof Anthropic.APIError) throw new ProviderError(this.id, 'http', `${e.status} ${e.message}`)
      throw new ProviderError(this.id, 'unknown', e instanceof Error ? e.message : String(e))
    }
  }
}
