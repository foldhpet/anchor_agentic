// PreToolUse hook: block edits to legacy folders (see .claude/rules/legacy.md).
// Exit code 2 blocks the tool call and feeds stderr back to Claude.
let input = ''
process.stdin.on('data', (chunk) => (input += chunk))
process.stdin.on('end', () => {
  let filePath = ''
  try {
    filePath = JSON.parse(input).tool_input?.file_path ?? ''
  } catch {
    process.exit(0)
  }
  const normalized = filePath.replaceAll('\\', '/')
  if (/\/(generator|example-taf)\//.test(normalized)) {
    console.error(
      `Blocked: ${filePath} is in a legacy folder (generator/ or example-taf/). ` +
        'These are historical reference only; ask the user before modifying them.',
    )
    process.exit(2)
  }
  process.exit(0)
})
