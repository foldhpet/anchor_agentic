---
description: Run a user story through the factory pipeline - test cases, implementation, automated tests, acceptance check, and review - without committing or pushing
argument-hint: <story id, e.g. US-014>
---

Run user story **$ARGUMENTS** through the pipeline below. Do the steps in order and keep each handoff explicit, because the sub-agents do not share context.

If `$ARGUMENTS` is empty or is not an ID that exists in `docs/USER-STORIES.md`, stop and ask for a valid story ID.

## 1. Ground the story
Read the story, its acceptance criteria, and its row in the Dependency Matrix in `docs/USER-STORIES.md`. If a dependency story is not yet implemented (check the code and tests), stop and report it instead of continuing. Summarize the story and acceptance criteria in a few lines.

## 2. Test cases
Use the **Test User Story Analyst Agent** with the full story text to produce test cases. It is read-only and returns them as text; keep them for steps 3 and 4.

## 3. Implement
Use the **Developer Agent**. Give it the story ID, the full acceptance criteria, and the test cases from step 2. Ask it to implement the story and its tests per the rules in `.claude/rules/`. It must not commit, push, deploy, or apply migrations.

## 4. Automate remaining tests
Use the **Test Automation Agent** with the test cases and the Developer Agent's list of changed files. Ask it to automate the cases not already covered, and to report any application defect rather than altering assertions. If a defect is reported, send it back to the Developer Agent once, then re-run the failing tests.

## 5. Acceptance check
Apply the `acceptance-criteria-check` skill to the story using the changed files and test results. Any criterion that is Not met means the pipeline stops here with a clear list of gaps.

## 6. Review
Run `git diff` and `git status` yourself, because the reviewers are read-only and cannot. Then, in parallel:
- **Code Reviewer Agent**: pass it the diff (include new untracked files by path) and the story reference.
- **Security Reviewer Agent**: pass it the same diff and file list.

## 7. Report
Finish with one report containing:
- Story ID and title
- Acceptance criteria table (Met / Not met / Not verifiable, with evidence)
- Files changed
- Test results per suite, and which suites could not run (for example RLS or e2e without live Supabase credentials)
- Code review and security review findings, ranked by severity
- Open follow-ups

Do not run `git commit` or `git push`. Leave the working tree for the user to inspect.
