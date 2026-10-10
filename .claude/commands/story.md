---
description: Run a user story through the factory pipeline - test cases, implementation, automated tests, mutation check, acceptance check, and review - without committing or pushing
argument-hint: <story id, e.g. US-014>
---

Run user story **$ARGUMENTS** through the pipeline below. Do the steps in order and keep each handoff explicit, because the sub-agents do not share context.

If `$ARGUMENTS` is empty or is not an ID that exists in `docs/USER-STORIES.md`, stop and ask for a valid story ID.

Standing rules for the whole run:
- Sub-agent reports are claims, not facts. Verify the ones you rely on yourself (see "Verify, don't trust" below).
- Sub-agents must not decide product questions. If an acceptance criterion is ambiguous or the code does something the story does not settle, they report what the code does today and you list it under "Decisions for the user".
- Never run `git commit` or `git push`, and never apply migrations or deploy. Leave the working tree for the user to inspect.
- Use the scratchpad directory from the system prompt for temporary files (diffs, backups), never the repo.

## 1. Ground the story
Read the story, its acceptance criteria, and its row in the Dependency Matrix in `docs/USER-STORIES.md`. If a dependency story is not yet implemented (check the code and tests), stop and report it instead of continuing. Then check whether the story is already implemented, fully or partly, by searching the routes, pages, and migrations it would touch; tell the Developer Agent what you found. Summarize the story and acceptance criteria in a few lines.

## 2. Test cases
Use the **Test User Story Analyst Agent** with the full story text to produce test cases. It is read-only and returns them as text; keep them for steps 3 and 4. Note any acceptance-criteria wording problems and open questions it raises.

## 3. Implement
Use the **Developer Agent**. Give it the story ID, the full acceptance criteria, the test cases from step 2, and what you found in step 1. Tell it to determine first which criteria are already implemented and to change only what is missing; not to rewrite working code; and to add the missing tests. It must follow `.claude/rules/` and must not commit, push, deploy, or apply migrations. Pass along the open product questions from step 2 and tell it not to decide them.

## 4. Automate remaining tests
Use the **Test Automation Agent** with the test cases and the Developer Agent's list of changed files. Ask it to automate the cases not already covered, to avoid duplicating the Developer Agent's tests, and to report any application defect rather than altering assertions. Tell it not to write tests for behavior the story leaves undecided; those go under "Not automated". If a defect is reported, send it back to the Developer Agent once, then re-run the failing tests.

## Verify, don't trust
After steps 3 and 4, check before continuing:
- `git status` and `git diff --stat` match the agents' changed-file lists. Look for unrelated reformatting (line-ending flips, Prettier rewrites; the api project has no Prettier config and the web tree is not fully Prettier-clean) and revert such hunks.
- Re-run the story's tests yourself. For suites that need live credentials (RLS, e2e), run them with a verbose reporter and confirm they ran rather than skipped. Do not read `.env` or `.dev.vars`; judge by whether the suite skipped.
- A claim of "passes" without a run, or "not run" because of a permission denial, is not evidence either way.

## 5. Mutation check
Tests that pass prove little unless they fail when the code is wrong. For each acceptance criterion with production logic (skip a story that changed no logic and has no code under test):
1. Pick 3-5 small mutations of the code under test: a wrong id or filter, a dropped scoping or ownership condition, an inverted condition, an off-by-one in ordering or renumbering.
2. For each: copy the production file to the scratchpad, apply the mutation, run only the story's tests, record how many fail, then restore the file from the copy and confirm with `git diff` that it is back to its pre-mutation state.
3. A mutation that no test catches is a gap. Send it to the Test Automation Agent to add an assertion, then repeat that mutation.
Never leave a mutation in place; if a run is interrupted, restore the file before doing anything else.

## 6. Acceptance check
Apply the `acceptance-criteria-check` skill to the story using the changed files and test results. Any criterion that is Not met means the pipeline stops here with a clear list of gaps. Partially met and Not verifiable criteria do not stop the pipeline but must appear in the report.

## 7. Review
The reviewers are read-only and cannot run git, so prepare their input yourself:
- Write `git diff` to a file in the scratchpad (for example `<story-id>.diff`) and list the changed files. `git diff` omits untracked files, so list those by path as well.
- Give each reviewer the diff file path, the file list, the story reference, and anything they cannot judge (for example "the e2e spec has not been run", the open product questions to leave out of scope).

Run in parallel:
- **Code Reviewer Agent**: correctness, test quality, conventions. Ask it to say explicitly whether assertions would catch wrong behavior.
- **Security Reviewer Agent**: authorization, RLS, secrets, test-data hygiene.

Reviewers also make mistakes. Before reporting a finding, check it against the files if it is cheap to do so, and say when a finding is wrong or already covered.

## 8. Report
Finish with one report containing:
- Story ID and title, and whether the behavior was already implemented
- Acceptance criteria table (Met / Partially met / Not met / Not verifiable, with evidence)
- Files changed
- Test results per suite, and which suites could not run (for example RLS or e2e without live Supabase credentials)
- Mutation check results (mutation, tests failing) and any gaps closed
- Code review and security review findings, ranked by severity, with corrections to any finding you found to be wrong
- Decisions for the user (ambiguous criteria, undecided behavior, production-code issues found but not fixed)
- Open follow-ups

Then ask whether to fix the Major findings and the minor ones. Fix only on request, using the Test Automation Agent for test findings and the Developer Agent for production code, and repeat the mutation check after the fixes. Do not commit until the user asks.
