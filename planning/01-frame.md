---
planning: true
artifact_type: frame
status: working
---

# Writing Assistant — Frame

## Source
- Existing README, server contracts, UI components, and tests in this repository.
- This is a retrospective product model proposed by an agent. It has not been accepted by the product owner.

## Problem
- A revision can improve prose while changing its meaning, qualifications, or evidence.
- An AI/code change can silently remove behaviors the product previously relied upon.
- An incomplete or invalid API request should not trigger a paid agent pipeline.

## Transformation frame (x → f() → y)
- x — current situation: Existing source and tests contain behavior, but intent is scattered across code, README, and test cases.
- f() — solution variable: Product intent model with executable, externally checkable behaviors.
- y — desired outcome: Changes can be checked against selected observed behavior without granting the agent authority to change it.
- Gap: Maintain traceability and independently test implementation against approved behavior.
- Boundaries: This pilot covers deterministic writer checks, API validation, and selected UI states; no claim of full semantic equivalence.

## Operating model
- Authority: Working
- Relevant conditions: Node 22 application, React/Vite frontend and an Express API; networked agent calls require credentials.
- Evidence refs: README.md; server/meaning-contract.mjs; tests/server.test.mjs; src/App.tsx
- Revisit conditions: Product owner approves or changes the product model.

## Outcome
- Existing semantic review cases remain detectable.
- Invalid inputs never initiate the writing pipeline.
- Users see meaningful submit and error states.
- Draft and result behaviors can be tested without calling a live model.

## Less about
- Changing the current editor design
- Inventing acceptance decisions
- Guaranteeing equivalence beyond covered scenarios

## More about
- Preserving decisions and qualifications
- Typed traceability from behavior to code
- Making unknown coverage explicit
