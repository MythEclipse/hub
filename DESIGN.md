# Design system

<!-- impeccable:design-schema 1 -->

The Inspection Clipboard Report world. A technician's triplicate
service-inspection form, printed on a bench.

## Physical scene

A field technician prints a service sheet at the start of a shift, fills it in
with the current readings, stamps it, and signs it. The page is that sheet. It
is read on an ordinary desk in ordinary light — so it is a **paper-light
surface by default**, with dark reserved for the stub bar and for a visitor who
asks for dark explicitly. Nothing glows; paper does not glow.

## Color

| Token | Light | Role |
|---|---|---|
| `--paper` | `#eceae4` | the ground — warm, slightly grey card stock |
| `--paper-raised` | `#f4f2ee` | a panel sitting above the ground |
| `--ink` | `#15181c` | primary type, rules, the stub bar |
| `--ink-soft` | `#3a3e44` | secondary type on paper |
| `--ink-faint` | `#6b6f76` | field labels, metadata |
| `--rule` | `#c9c6bf` | hairline separators |
| `--rule-soft` | `#d5d2cb` | inside a table row |
| `--pass` | `#1f6b3a` | running, verified, up |
| `--fail` | `#c0392b` | degraded, failed, down |
| `--pending` | `#9a6b16` | pending, stale, queued |

Dark is one inversion of the same palette, not a second theme: ground
`#15181c`, panel `#1c1f24`, ink `#eceae4`, rules `#2e3238`. The semantic trio is
unchanged and keeps its meaning.

**The rule that carries the world:** colour is a reading, never a decoration.
Every saturated mark answers exactly one question — running or not, pass or
fail, present or absent. `--pending` is the only colour allowed on an
unresolved value. There is no accent colour, because a form has no accent.

## Type

Two faces, both self-hosted from the project's own dependency tree.

- **Mono** — every label, figure, index number, timestamp, status mark, and
  tabular column. This is the form's hand: the technician writes readings.
- **Sans** — prose only: the about paragraphs and project summaries. Never for
  a label.

Scale: display 34/700 for the name on the subject block and the 44/700 form
mark; section label 10px, `letter-spacing: .16em`, uppercase; body 13/1.5 sans
at a 65ch measure; table cell 13 mono; field value 10 mono. Body copy never
drops below 13px — the readers are non-native English speakers evaluating a
technical claim, so legibility is functional, not decorative.

## Form grammar

- **Radius is 0.** A printed sheet has square corners. The only exception is
  the 1px-radius focus ring.
- **Separation is by hairline rule**, never by shadow and never by a gap alone.
  Every panel boundary is a 1px `--rule` line. Depth does not exist in this
  world; a panel is defined by being *bounded*, not by floating above another.
- **The stub bar.** A full-height ink column at the left edge, 132px at desktop,
  carrying the form id, the cycle clock, and nothing else. It is the one region
  of the page that is allowed to be solid ink.
- **Verification stamp.** A 2px-bordered box set at `rotate(-2.5deg)`, marking
  the form verified with the time. It is the page's one piece of hand presence.

## Layout

Three columns at desktop: stub bar (132px) · subject + countersign (196px) ·
ledger (fluid). The rule between column two and three is a full-height 1px
hairline, the same weight as every other rule. At 1024px the subject column
narrows; at 768px it stacks under the stub bar; at 390px the stub bar becomes a
single top strip and ledger rows stack name over mechanism.

Vertical rhythm is a single 8px scale. More space above a heading than below it,
always.

## Motion

The form fills itself in. On first paint the sheet prints (a 240ms ink-bleed
on the rules, then content). Afterwards, **one authored moment**: every 15 s
poll re-fills the reading cells in place — the figures cross-fade, the status
marks tick, and the verification stamp re-sets with a 180ms rotate-and-settle.
No card lifts on hover, no gradient shift, no parallax. A form is not a poster.

Every animation is inside `@media (prefers-reduced-motion: reduce)`. There is
no `motion/react` stagger vocabulary in this world; the form does not cascade.

## Components

- **Ledger row** — index · name · mechanism · status marks · figure. Hairline
  bottom. Hover darkens the row by one ink step; nothing moves.
- **Field** — a label above a value, the form's atom. Used for countersign, node
  resources, and every reading.
- **Stamp** — the verification box. One per page, bottom-right of the ledger.
- **Checkbox mark** — a drawn square with a stroke, used for the per-project
  status trio. Never a unicode glyph.

## What this world refuses

No shadows at any blur. No rounded corners above 1px. No gradients. No glass or
backdrop blur. No card grid of equal icon-plus-heading-plus-text. No
centre-over-cards hero. No accent colour. No sparkle, glow, or neon. Every one
of those is the previous world's vocabulary, and the previous world is the
anti-reference.
