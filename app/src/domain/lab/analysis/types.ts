import type { DailyDataset, EventDataset } from './datasetBuilders'

/**
 * A finding from correlation analysis
 */
export interface LabFinding {
  projectId: string
  tagId: string
  method: string // e.g., 'presence-effect', 'lag-1', 'rolling-3d'
  effect: number // Numeric effect size (positive or negative)
  confidence: 'low' | 'medium' | 'high'
  sampleSize: number // How many observations contributed
  summary: string // Human-readable summary
  rawData?: unknown // Optional raw data for detailed display
}

/**
 * Correlation method that analyzes daily datasets
 */
export interface DailyCorrelationMethod {
  kind: 'daily'
  name: string
  run: (dataset: DailyDataset, projectId: string) => LabFinding[]
}

/**
 * Correlation method that analyzes event datasets
 */
export interface EventCorrelationMethod {
  kind: 'event'
  name: string
  run: (dataset: EventDataset, projectId: string) => LabFinding[]
}

/**
 * Union type for all correlation methods
 */
export type LabCorrelationMethod = DailyCorrelationMethod | EventCorrelationMethod
