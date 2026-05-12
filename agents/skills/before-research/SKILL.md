---
name: before-research
description: Initialises a RESEARCH_CONTEXT.md file in the current directory by interviewing the user about their research. Used to give the do-research skill a standing research context so that generated notes highlight what is relevant to the user's current work.
---

# init-research-context

Your job is to produce a `RESEARCH_CONTEXT.md` file in the current working directory by asking the user focused questions about their research. The file will be read by the `do-research` skill every time it analyses a paper from this workspace.

## Before you start

Check whether `RESEARCH_CONTEXT.md` already exists in the current directory. If it does, read it, show the user a summary of what's there, and ask: "Do you want to update the existing context or start fresh?" Proceed accordingly.

## Interview

Ask the following questions **one at a time**, waiting for the user's answer before proceeding. Do not batch them.

1. **Research goal:** "What problem are you working on and what are you trying to build or prove? Give me a paragraph — the more specific the better."

2. **Key questions:** "What are the specific open questions you're currently trying to answer? List them — one per line is fine. These are the questions you want the reading agent to map every paper against."

3. **Methods and approaches:** "What methods or approaches are you currently exploring or have already committed to? (e.g. specific architectures, training strategies, datasets)"

4. **Out of scope:** "What are you explicitly NOT interested in right now? This helps the agent avoid wasting depth on irrelevant sections."

5. **Adjacent areas:** "Are there any closely related research areas or communities you're watching even if they're not your direct focus? Papers from these areas may be partially relevant."

After each answer, ask one clarifying follow-up if the answer is vague or too broad — but only one. Don't over-interview.

## Write the file

Once all questions are answered, write `RESEARCH_CONTEXT.md` in the current directory:

```markdown
## Research Goal

<synthesised paragraph from answer 1, written in second person as "You are working on...">

## Key Questions

<bullet list from answer 2, each question as a single crisp line>

## Methods & Approaches

<bullet list from answer 3>

## Out of Scope

<bullet list from answer 4>

## Adjacent Areas

<bullet list from answer 5, omit section entirely if the user said none>
```

Keep each section tight — this file is read by an agent on every paper analysis, so clarity and specificity matter more than completeness. If the user gave vague answers, sharpen them before writing.

Confirm with: "RESEARCH_CONTEXT.md written. Run /do-research from this directory to analyse a paper with this context."
