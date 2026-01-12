# Project conventions

- Stack: React + TypeScript
- State management: local state + custom domain stores (no Redux)
- Persistence: localStorage via storageService
- Styling: CSS modules (or plain CSS / Tailwind — your choice)
- Date handling: native Date + YYYY-MM-DD strings (no Moment)
- No backend, no auth
- Target: desktop-first, personal use

## Implementation philosophy

- Prefer simple, explicit solutions over abstract or clever ones.
- Avoid over-engineering:
  - No unnecessary layers, patterns, or indirection.
  - No premature optimization.
- Write code that is easy to read and reason about for a non-expert developer.
- If a feature can be implemented in a straightforward way, do not generalize it.
- Avoid creating utilities, helpers, or abstractions unless they are clearly reused.
- Favor clarity and maintainability over flexibility.

