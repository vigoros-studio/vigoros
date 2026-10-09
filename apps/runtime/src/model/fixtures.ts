/**
 * Schema-valid fixtures for the fake adapter. They read like plausible work so the headquarters
 * can be exercised end to end, and every one is labelled SIMULATED so none of it can pass as a
 * real finding. Nothing here came from research, a model, or an audience.
 */
const SIM = '[SIMULATED]'

export const FIXTURES: Record<string, unknown> = {
  OpportunityReport: {
    opportunities: [
      {
        title: `${SIM} "Get ready with me" but she never leaves`,
        format:
          'A GRWM-style voiceover over a full outfit change that ends with Bunni back on the sofa.',
        whyBunni:
          'The format expects aspiration; Bunni supplies total commitment to doing nothing. The outfit library already covers it.',
        hookIdea: 'Getting dressed for the fridge.',
        sources: [{ url: 'fixture://simulated', note: 'Fixture. No search was performed.' }],
        confidence: 0,
      },
      {
        title: `${SIM} Emergency meeting about one missing nugget`,
        format: 'Tiny CEO outfit, boardroom energy, a single domestic grievance.',
        whyBunni:
          'Her bible treats a missing snack as betrayal and she becomes CEO of things nobody asked for.',
        hookIdea: 'We need to talk about the nugget.',
        sources: [{ url: 'fixture://simulated', note: 'Fixture. No search was performed.' }],
        confidence: 0,
      },
      {
        title: `${SIM} Replying to a text in six hours`,
        format: 'Phone-in-paw, long silent stare, one brutal sentence typed and deleted.',
        whyBunni:
          'Overthinking a message for six hours is in her habits list; silence is her joke.',
        hookIdea: 'It has been four hours. I am composing.',
        sources: [{ url: 'fixture://simulated', note: 'Fixture. No search was performed.' }],
        confidence: 0,
      },
    ],
  },
  DirectorPick: {
    chosenIndex: 1,
    brief: `${SIM} Episode brief: Bunni, in the Tiny CEO outfit, convenes an emergency meeting at the kitchen table about one missing chicken nugget. The joke is her total seriousness: agenda, eye contact, a slide. Nine to fifteen seconds, hook in the first second, one idea only. Setting: a real kitchen at night, low camera.`,
    reasoning:
      'Fixture reasoning: fits the storyline (she is CEO of things nobody asked for) and uses an existing outfit.',
    alternatives: [
      { index: 0, whyNot: 'Needs an outfit change sequence we have not rendered yet.' },
      { index: 2, whyNot: 'Stronger as a follow-up once the audience knows her.' },
    ],
  },
  ScriptDraft: {
    title: `${SIM} Board meeting about a nugget`,
    hook: 'One nugget is missing and this is now a board matter.',
    logline: 'Bunni calls an emergency meeting about a missing nugget and treats it like a merger.',
    outfit: 'tiny-ceo',
    accessory: 'none',
    setting: 'A real kitchen table at night, one lamp, the nugget box open',
    beats: [
      {
        beat: 1,
        action: 'Bunni stares at the open nugget box. Long pause.',
        line: null,
        expression: 'judging',
      },
      {
        beat: 2,
        action: 'She slides a notepad across the table toward the camera.',
        line: 'We need to talk.',
        expression: 'neutral',
      },
      {
        beat: 3,
        action: 'She taps the notepad once with a paw.',
        line: 'There were six.',
        expression: 'sassy',
      },
      {
        beat: 4,
        action: 'She leans back and folds her arms.',
        line: "I'm not angry. I'm restructuring.",
        expression: 'tired',
      },
    ],
    caption: 'This feels targeted.',
    hashtags: ['#bunni', '#bunniisreal', '#ceo'],
  },
  Ranking: {
    ranked: [
      {
        candidate: 'Writer A',
        score: 7.5,
        strengths: 'Fixture: the pause before "We need to talk" is the joke.',
        weaknesses: 'Fixture: beat 3 could lose a word.',
        canonRisks: [],
      },
      {
        candidate: 'Writer B',
        score: 6.5,
        strengths: 'Fixture: escalation is clean.',
        weaknesses: 'Fixture: beat 4 explains the joke.',
        canonRisks: ['Fixture: check paws, not hands, when tapping the notepad.'],
      },
    ],
    winner: 'Writer A',
    reasoning: `${SIM} Fixture ranking. A wins on economy of lines.`,
    continuityNotes: [
      `${SIM} First time the Tiny CEO outfit appears; could become a recurring "board meeting" format.`,
    ],
  },
  ProductionEstimate: {
    episodeSlug: 'simulated-board-meeting-about-a-nugget',
    shots: 4,
    keyframes: 4,
    videoSeconds: 16,
    assetsNeeded: [
      'outfits/tiny-ceo.png',
      'expressions/judging.png',
      'expressions/sassy.png',
      'expressions/tired.png',
      'prop: nugget box',
      'prop: notepad',
    ],
    risks: [
      `${SIM} Paws tapping a notepad are a hand-anatomy risk.`,
      `${SIM} Blazer sleeves in motion need the outfit reference on every shot.`,
    ],
  },
  MeasurementPlan: {
    hypothesis: `${SIM} A deadpan board-meeting format with the hook in the first second holds attention better than a voiceover opening.`,
    primaryMetric: '3-second hold rate',
    secondaryMetrics: ['average watch time', 'completion rate', 'shares per 1k views'],
    successThreshold: 'Fixture: 3-second hold above 60% on the first 1,000 views.',
    readAfterHours: 48,
  },
  ApprovalItem: {
    headline: `${SIM} Approve "Board meeting about a nugget" for production`,
    summary: `${SIM} Writer A's script won the review on economy of lines. Four shots, Tiny CEO outfit, one real kitchen setting. The measurement plan tests the first-second hook. Everything in this item was produced by the fake adapter; no research or model work has happened.`,
    recommendation: 'approve',
    reasoning:
      'Fixture recommendation: lowest-risk first episode because it uses one setting and an existing outfit.',
  },
  DirectorPlan: {
    summary: `${SIM} Understood. I will start an episode workflow focused on relatable chaotic comedy and have the reviewer return the strongest script.`,
    startWorkflow: true,
    focus: 'relatable chaotic comedy',
    guidance:
      'Small domestic problem, treated with total seriousness. Hook in the first second. Keep lines short.',
    returnCount: 1,
  },
  Acknowledgement: {
    summary: `${SIM} Noted. I will fold this into my next task.`,
    actions: ['Fixture: apply the instruction on the next run.'],
    needsFounder: null,
  },
  Briefing: {
    greeting: `${SIM} Good morning. This briefing was produced by the fake adapter.`,
    highlights: [],
    decisionsAwaiting: [],
  },
}
