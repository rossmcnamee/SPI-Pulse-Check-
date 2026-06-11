import type { AdTotals } from './metrics'
import { makeTrend } from './metrics'
import { fmtEur } from './format'

// =============================================================================
// AI overview panel (Section 9) — RULE-BASED for v1, deterministic, no API.
//
// The function signature is intentionally shaped so a real Claude call can be
// dropped in later WITHOUT touching the Paid Ads tab. See TODO below.
// =============================================================================

export interface CampaignTotals {
  name: string
  current: AdTotals
  prior: AdTotals
}

export interface ChannelInsightInput {
  channelLabel: string
  current: AdTotals
  prior: AdTotals
  campaigns: CampaignTotals[]
}

export interface AiSummary {
  sentences: string[]
  source: 'rules' | 'llm'
}

function pct(value: number, prev: number): number | null {
  return makeTrend(value, prev).deltaPct
}

function dir(p: number | null): string {
  if (p === null) return 'changed'
  if (p > 0.5) return 'up'
  if (p < -0.5) return 'down'
  return 'flat'
}

function absPct(p: number | null): string {
  return p === null ? '—' : `${Math.abs(p).toFixed(0)}%`
}

// ---- Rule-based generator ---------------------------------------------------
export function generateChannelSummary(input: ChannelInsightInput): AiSummary {
  const { channelLabel, current, prior, campaigns } = input
  const sentences: string[] = []

  if (current.conversions === 0 && current.spend === 0) {
    return { sentences: [`No ${channelLabel} activity in the selected range.`], source: 'rules' }
  }

  // 1) Direction: conversions vs spend vs efficiency.
  const convP = pct(current.conversions, prior.conversions)
  const spendP = pct(current.spend, prior.spend)
  const cpa = current.costPerConversion
  const cpaPrev = prior.costPerConversion
  const cpaP = pct(cpa, cpaPrev)
  const effWord = cpaP === null ? 'held' : cpaP < 0 ? 'improved' : cpaP > 0 ? 'worsened' : 'held'
  sentences.push(
    `${channelLabel} conversions are ${dir(convP)} ${absPct(convP)} vs the prior period while spend is ${dir(
      spendP,
    )} ${absPct(spendP)}, so cost per conversion ${effWord}${
      cpaPrev > 0 && cpa > 0 ? ` from ${fmtEur(cpaPrev)} to ${fmtEur(cpa)}` : ''
    }.`,
  )

  // 2) Efficiency flag: spend rose but conversions fell -> worst offender.
  const flagged = campaigns
    .filter((c) => c.current.spend > c.prior.spend && c.current.conversions < c.prior.conversions && c.prior.conversions > 0)
    .sort((a, b) => (b.current.spend - b.prior.spend) - (a.current.spend - a.prior.spend))
  if (flagged.length) {
    const c = flagged[0]
    const cCpaP = pct(c.current.costPerConversion, c.prior.costPerConversion)
    sentences.push(
      `Watch the “${c.name}” campaign: spend rose but conversions fell, pushing its cost per conversion up ${absPct(
        cCpaP,
      )}.`,
    )
  }

  // 3) Best & worst by cost per conversion (campaigns with conversions in range).
  const ranked = campaigns
    .filter((c) => c.current.conversions > 0)
    .sort((a, b) => a.current.costPerConversion - b.current.costPerConversion)
  if (ranked.length >= 2) {
    const best = ranked[0]
    const worst = ranked[ranked.length - 1]
    sentences.push(
      `Most efficient is “${best.name}” at ${fmtEur(best.current.costPerConversion)} per conversion; least efficient is “${
        worst.name
      }” at ${fmtEur(worst.current.costPerConversion)}.`,
    )
  }

  return { sentences: sentences.slice(0, 4), source: 'rules' }
}

// ---- Future LLM swap --------------------------------------------------------
// TODO: replace the body of this function with a Claude API call that takes the
// same ChannelInsightInput and returns AiSummary (source: 'llm'). The Paid Ads
// tab already awaits this signature, so no component changes are required.
export async function generateChannelSummaryLLM(input: ChannelInsightInput): Promise<AiSummary> {
  // TODO: call Claude here, e.g. anthropic.messages.create({...}) with `input`
  // serialised as context, and map the response into { sentences, source: 'llm' }.
  return generateChannelSummary(input)
}
