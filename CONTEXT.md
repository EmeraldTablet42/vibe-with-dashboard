# Glossary

## Active Board

The editable board for the current task. It contains the live Plan, Kanban cards, and current work state.

## Dashboard Contract

The shared agreement between an LLM agent and the dashboard: the agent writes the working plan, keeps cards current as work units move, records phase-level activity, and lets completed boards become Archives.

## Work Card

A trackable unit of agent work. Work Cards appear in both Plan and Kanban, carry status and priority, and should be updated when the corresponding work starts, waits for review, or finishes.

## Archive

A read-only snapshot of a completed board. Archived boards preserve Plan, Kanban, and Activity records without allowing edits.

## Activity

A concise phase-level record written by an LLM agent or launcher. Activity entries describe start, plan, implement, verify, result, or fail states.

## Inspector

A folded project snapshot panel for repo, GitHub, design token, harness, skill, MCP, and agent information.

## Locale

The browser-preferred UI language. The shell supports English and Korean, falls back to English text for unsupported languages, and can display agent-supplied translations for Plan and Kanban items.

## Rubber Duck

A floating dashboard companion that displays agent-written project suggestions for the Active Board. It does not generate advice inside the web app.
