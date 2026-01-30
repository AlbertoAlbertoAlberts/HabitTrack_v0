# LAB Domain Structure

This directory contains all LAB-related domain logic, organized into clear modules.

## Folder Structure

```
domain/lab/
├── actions/           # State modification functions
│   ├── labProjects.ts    # Project CRUD operations
│   ├── labTags.ts        # Tag management
│   ├── labDailyLogs.ts   # Daily project logging
│   ├── labEventLogs.ts   # Event project logging
│   └── index.ts          # Centralized exports
│
├── analysis/          # Analysis engine
│   ├── types.ts          # Analysis type definitions (LabFinding, LabCorrelationMethod)
│   ├── datasetBuilders.ts   # Transform logs → analysis-ready datasets
│   ├── methods.ts        # 5 v1 correlation methods (presence, lag, rolling, dose, regime)
│   ├── runner.ts         # Orchestrates analysis with guardrails
│   ├── cache.ts          # Fingerprint-based findings cache
│   ├── summaryBuilder.ts # Human-readable summary generation
│   └── index.ts          # Centralized exports
│
└── index.ts           # Top-level LAB exports
```

## Import Patterns

### Preferred (Cleaner):
```typescript
// From within domain/lab
import { addLabProject, updateLabProject } from './actions'
import { runAnalysisForProject, buildDailyDataset } from './analysis'

// From outside domain/lab
import { addLabProject, updateLabProject } from '@/domain/lab/actions'
import { runAnalysisForProject, buildDailyDataset } from '@/domain/lab/analysis'
```

### Alternative (Explicit):
```typescript
import { addLabProject } from '@/domain/lab/actions/labProjects'
import { runAnalysisForProject } from '@/domain/lab/analysis/runner'
```

## Design Principles

1. **Separation of Concerns**: Actions modify state, analysis reads state
2. **Pure Functions**: All analysis methods are side-effect free
3. **Type Safety**: Discriminated unions throughout (DailyCorrelationMethod | EventCorrelationMethod)
4. **Caching**: Fingerprint-based invalidation prevents unnecessary recomputation
5. **Human-Readable**: All findings include natural language summaries

## Related Files

- **Type Definitions**: `/domain/types.ts` (LabState, LabProject, LabTag, etc.)
- **State Management**: `/domain/store/appStore.ts` (integrates LAB actions)
- **Utilities**: `/domain/utils/` (generateId, localDate, labValidation)

## Phase Completion Status

✅ Phase 0-6: Complete (state, CRUD, logging, datasets, analysis, findings UI)
🚧 Phase 7: In progress (stability & cleanup)
⏳ Release 1.0.0: Pending (final polish)
