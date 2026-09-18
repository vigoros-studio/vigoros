import OpenAI from 'openai'
import { sha256Hex } from '@vigoros/domain'
import { ANSWER_JSON_SCHEMA, SYSTEM_PROMPT, formatQuestions } from './prompt'
import { AnswerBatchSchema, ProviderError, type ForecastProvider, type ForecastResult, type PromptQuestion } from './types'

export interface OpenAICompatibleOptions {
  /** 'openai' or 'deepseek'; recorded on the run. */
  id: string
  model: string
  apiKey: string
  baseURL?: string
  /** OpenAI supports json_schema; DeepSeek supports json_object only. */
  jsonMode: 'schema' | 'object'
  client?: OpenAI
}

/** OpenAI, and any provider speaking the chat completions protocol, such as DeepSeek. */
export class OpenAICompatibleProvider implements ForecastProvider {
  readonly id: string
  readonly model: string
  private readonly client: OpenAI
  private readonly jsonMode: 'schema' | 'object'

  constructor(opts: OpenAICompatibleOptions) {
    this.id = opts.id
    this.model = opts.model
    this.jsonMode = opts.jsonMode
    this.client =
      opts.client ?? new OpenAI(opts.baseURL ? { apiKey: opts.apiKey, baseURL: opts.baseURL } : { apiKey: opts.apiKey })
  }

  async forecast(questions: readonly PromptQuestion[], asOf: string): Promise<ForecastResult> {
    const user = formatQuestions(questions, asOf)
    const requestHash = await sha256Hex(`${this.model}|${SYSTEM_PROMPT}|${user}`)
    const systemText =
      this.jsonMode === 'object'
        ? `${SYSTEM_PROMPT}\n\nReturn a JSON object of the form {"answers":[{"question_id":"...","p":0.5,"reasoning":"..."}]}.`
        : SYSTEM_PROMPT
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemText },
          { role: 'user', content: user },
        ],
        response_format:
          this.jsonMode === 'schema'
            ? { type: 'json_schema', json_schema: { name: 'answers', strict: true, schema: ANSWER_JSON_SCHEMA } }
            : { type: 'json_object' },
      })
      const choice = completion.choices[0]
      if (!choice) throw new ProviderError(this.id, 'invalid_output', 'no choices')
      if (choice.finish_reason === 'content_filter') throw new ProviderError(this.id, 'refusal', 'content filter')
      const text = choice.message.content ?? ''
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new ProviderError(this.id, 'invalid_output', `not json: ${text.slice(0, 80)}`)
      }
      const result = AnswerBatchSchema.safeParse(parsed)
      if (!result.success) throw new ProviderError(this.id, 'invalid_output', result.error.message.slice(0, 200))
      return {
        answers: result.data.answers,
        usage: {
          inputTokens: completion.usage?.prompt_tokens ?? 0,
          outputTokens: completion.usage?.completion_tokens ?? 0,
        },
        requestHash,
        responseHash: await sha256Hex(text),
      }
    } catch (e) {
      if (e instanceof ProviderError) throw e
      if (e instanceof OpenAI.RateLimitError) throw new ProviderError(this.id, 'rate_limit', e.message)
      if (e instanceof OpenAI.APIError) throw new ProviderError(this.id, 'http', `${e.status} ${e.message}`)
      throw new ProviderError(this.id, 'unknown', e instanceof Error ? e.message : String(e))
    }
  }
}
