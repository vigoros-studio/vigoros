/** Schema-valid placeholders for the fake adapter. Visibly fake so they never pass as creative work. */
export const FIXTURES: Record<string, unknown> = {
  OpportunityReport: {
    opportunities: [
      {
        title: '[FAKE] Placeholder opportunity',
        format: 'Dry-run output from the fake adapter; no research was performed.',
        whyBunni: 'None. This exists to exercise the pipeline without spending.',
        hookIdea: '[FAKE]',
        sources: [],
        confidence: 0,
      },
    ],
  },
  DirectorPick: {
    chosenIndex: 0,
    brief: '[FAKE] brief',
    reasoning: 'fake adapter',
    alternatives: [],
  },
  ScriptDraft: {
    title: '[FAKE] Script',
    hook: '[FAKE] hook',
    logline: 'fake',
    outfit: 'default',
    accessory: 'none',
    setting: 'fake',
    beats: [
      { beat: 1, action: '[FAKE]', line: null, expression: 'neutral' },
      { beat: 2, action: '[FAKE]', line: 'No.', expression: 'judging' },
    ],
    caption: '[FAKE]',
    hashtags: [],
  },
  Ranking: {
    ranked: [
      { candidate: 'fake', score: 0, strengths: 'none', weaknesses: 'fake', canonRisks: [] },
    ],
    winner: 'fake',
    reasoning: 'fake adapter',
    continuityNotes: [],
  },
  ProductionEstimate: {
    episodeSlug: 'fake',
    shots: 2,
    keyframes: 2,
    videoSeconds: 8,
    assetsNeeded: [],
    risks: ['fake adapter'],
  },
  MeasurementPlan: {
    hypothesis: '[FAKE]',
    primaryMetric: 'none',
    secondaryMetrics: [],
    successThreshold: 'none',
    readAfterHours: 24,
  },
  ApprovalItem: {
    headline: '[FAKE] approval item',
    summary: 'fake adapter',
    recommendation: 'reject',
    reasoning: 'fake',
  },
  Briefing: { greeting: '[FAKE] briefing', highlights: [], decisionsAwaiting: [] },
}
