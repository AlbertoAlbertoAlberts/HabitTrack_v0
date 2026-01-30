/**
 * Human-readable summary generation for findings
 */

interface SummaryContext {
  tagName: string
  effect: number
  method: string
  sampleSize: number
  confidence: 'low' | 'medium' | 'high'
  avgWith?: number
  avgWithout?: number
  avgLow?: number
  avgHigh?: number
  lowPresencePercent?: number
  highPresencePercent?: number
  lag?: number
  window?: number
}

/**
 * Generate a human-readable summary for a finding
 */
export function buildHumanSummary(context: SummaryContext): string {
  const { tagName, effect, method, avgWith, avgWithout, avgLow, avgHigh, lowPresencePercent, highPresencePercent, lag, window } = context

  const effectMagnitude = Math.abs(effect)
  const direction = effect > 0 ? 'increases' : 'decreases'
  const directionAdjective = effect > 0 ? 'better' : 'worse'

  // Magnitude descriptors
  let magnitudeWord = 'slightly'
  if (effectMagnitude >= 2.0) magnitudeWord = 'strongly'
  else if (effectMagnitude >= 1.0) magnitudeWord = 'noticeably'
  else if (effectMagnitude >= 0.5) magnitudeWord = 'moderately'

  switch (method) {
    case 'presence-effect':
      if (avgWith !== undefined && avgWithout !== undefined) {
        return `${tagName} ${magnitudeWord} ${direction} your outcome by ${effectMagnitude.toFixed(1)} points (${avgWith.toFixed(1)} with vs ${avgWithout.toFixed(1)} without)`
      }
      return `${tagName} ${magnitudeWord} ${direction} your outcome`

    case 'lag-1':
    case 'lag-2':
    case 'lag-3':
      if (avgWith !== undefined && avgWithout !== undefined) {
        const days = lag || parseInt(method.split('-')[1])
        return `${tagName} yesterday${days > 1 ? ` (${days} days ago)` : ''} makes today ${effectMagnitude.toFixed(1)} points ${directionAdjective} (${avgWith.toFixed(1)} vs ${avgWithout.toFixed(1)})`
      }
      return `${tagName} has a delayed effect on your outcome`

    case 'rolling-3d':
    case 'rolling-7d':
      if (avgHigh !== undefined && avgLow !== undefined) {
        const windowDays = window || (method === 'rolling-3d' ? 3 : 7)
        return `More ${tagName} over ${windowDays} days leads to ${effectMagnitude.toFixed(1)} point ${direction} (${avgHigh.toFixed(1)} high exposure vs ${avgLow.toFixed(1)} low)`
      }
      return `Accumulated ${tagName} affects your outcome`

    case 'dose-response':
      if (avgHigh !== undefined && avgLow !== undefined) {
        return `Higher intensity ${tagName} gives ${effectMagnitude.toFixed(1)} points ${directionAdjective} results (${avgHigh.toFixed(1)} high vs ${avgLow.toFixed(1)} low)`
      }
      return `${tagName} intensity matters for your outcome`

    case 'regime-summary':
      if (highPresencePercent !== undefined && lowPresencePercent !== undefined) {
        const isMoreOnGoodDays = effect > 0
        if (isMoreOnGoodDays) {
          return `You do ${tagName} ${highPresencePercent.toFixed(0)}% of good days vs ${lowPresencePercent.toFixed(0)}% of bad days – strong pattern!`
        } else {
          return `You do ${tagName} ${lowPresencePercent.toFixed(0)}% of bad days vs ${highPresencePercent.toFixed(0)}% of good days – consider reducing`
        }
      }
      return `${tagName} is linked to your outcome patterns`

    default:
      return `${tagName} ${direction} your outcome by ${effectMagnitude.toFixed(1)} points`
  }
}

/**
 * Get confidence explanation in plain language
 */
export function getConfidenceExplanation(confidence: 'low' | 'medium' | 'high', sampleSize: number): string {
  switch (confidence) {
    case 'high':
      return `Strong confidence (${sampleSize} observations)`
    case 'medium':
      return `Moderate confidence (${sampleSize} observations)`
    case 'low':
      return `Preliminary finding (only ${sampleSize} observations – keep logging!)`
  }
}

/**
 * Get actionable advice based on finding
 */
export function getActionableAdvice(effect: number, confidence: 'low' | 'medium' | 'high'): string | null {
  if (confidence === 'low') {
    return 'Log more data to confirm this pattern'
  }

  const magnitude = Math.abs(effect)
  
  if (effect > 0) {
    if (magnitude >= 1.0) {
      return 'This is helping! Consider doing it more often'
    } else if (magnitude >= 0.5) {
      return 'Positive signal – worth continuing'
    }
  } else {
    if (magnitude >= 1.0) {
      return 'Strong negative effect – consider reducing or eliminating'
    } else if (magnitude >= 0.5) {
      return 'May be holding you back – worth investigating'
    }
  }

  return null
}
