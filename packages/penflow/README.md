# penflow

Animated handwriting renderer using Typr.js glyph contours.

## Install

```bash
pnpm add penflow
```

## React Usage

```tsx
import { Penflow } from 'penflow/react';

<Penflow
  text="hello world"
  fontUrl="/fonts/BrittanySignature.ttf"
  quality="balanced"
  seed="demo"
/>
```

## Emoji and missing glyphs

Characters the font has no glyph for (emoji, mostly) can't be traced like a
letter, so they're drawn with a system emoji font when their turn comes. Pick
how they arrive with `fallback`:

| `fallback` | |
|---|---|
| `fade` (default) | fades in |
| `pop` | scales up with a small overshoot |
| `wipe` | revealed left to right, like the pen passing over it |
| `instant` | appears at once |
| `none` | not drawn (the old behaviour) |

```tsx
<Penflow text="you rock 😊" fontUrl="/fonts/BrittanySignature.ttf" fallback="pop" />
```

`fallbackFont` sets the CSS font-family they're drawn with.

## License

MIT
