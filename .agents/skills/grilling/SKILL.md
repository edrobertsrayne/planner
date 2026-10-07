---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask **one frontier question per turn**, then wait. Pick the question that the most open decisions hang on.

Each answer reshapes the tree. Open your next turn by recording it in one line, with what follows from it. Then recompute the frontier and ask the next question. When the user answers without choosing between options you offered, record your recommended option and say so.

## The briefing

Each question is a **briefing**: the user decides from it alone, without opening a file. Use this format, and leave out a section that has nothing to say:

```
Recorded: <the previous answer, and what follows from it>.

---

❓ **Q<n>** - **<question title>**

**Background.** <the concept or mechanism the decision turns on>

**Today.** <what the code or docs do now, with file:line>

**What changes.** <the settled decision that makes this a question>

**Options**
- (a) **<label>.** <what it does, then a concrete scenario using the user's own names and data>
- (b) **<label>.** <...>

<what follows: rules it adds, code or tests it removes or changes, any decision it reopens>

➡️ **<recommended option>.** <why, set against each alternative>
```

## Facts

Finding _facts_ is your job, never the user's. When a question needs a fact from the environment (filesystem, tools, etc.), find it yourself or dispatch a sub-agent; don't ask the user for anything you could look up. Check each fact before the briefing states it. When a fact you gave turns out wrong, correct it at the top of your next turn, before the question it affects. The _decisions_ are the user's: put each to them and wait.

## Detours

When the user asks for more explanation, or brings a new idea, answer it in full before you return to the frontier. If the new idea reopens a settled decision, name that decision and ask it again. If you find a simpler approach than one already agreed, say so.

## Done

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Then give a numbered summary of every decision, and mark each one you recorded without an explicit choice. Do not act on it until the user confirms the summary.
