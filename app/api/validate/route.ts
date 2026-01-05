import { NextResponse } from "next/server"
import ts from "typescript"

interface ValidationError {
  file: string
  line: number
  column: number
  message: string
  severity: "error" | "warning"
}

interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

function validateTypeScript(filename: string, content: string): ValidationError[] {
  const errors: ValidationError[] = []

  // Create a compiler host
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    noEmit: true,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
  }

  // Create a virtual file system
  const sourceFile = ts.createSourceFile(
    filename,
    content,
    ts.ScriptTarget.ES2022,
    true,
    filename.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

  // Check for syntax errors using the scanner
  const syntaxErrors: ts.Diagnostic[] = []

  // Parse and collect syntax diagnostics
  const parseResult = ts.createSourceFile(
    filename,
    content,
    ts.ScriptTarget.ES2022,
    true,
    filename.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

  // Get syntax diagnostics
  const parseDiagnostics = (parseResult as any).parseDiagnostics || []

  for (const diag of parseDiagnostics) {
    const pos = parseResult.getLineAndCharacterOfPosition(diag.start || 0)
    errors.push({
      file: filename,
      line: pos.line + 1,
      column: pos.character + 1,
      message: ts.flattenDiagnosticMessageText(diag.messageText, "\n"),
      severity: "error",
    })
  }

  // Additional syntax checks via regex for common issues
  const lines = content.split("\n")

  // Check for unbalanced braces
  let braceCount = 0
  let bracketCount = 0
  let parenCount = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Skip strings and comments for brace counting
    const cleanLine = line
      .replace(/\/\/.*$/, "")
      .replace(/"[^"]*"/g, "")
      .replace(/'[^']*'/g, "")

    for (const char of cleanLine) {
      if (char === "{") braceCount++
      if (char === "}") braceCount--
      if (char === "[") bracketCount++
      if (char === "]") bracketCount--
      if (char === "(") parenCount++
      if (char === ")") parenCount--
    }
  }

  if (braceCount !== 0) {
    errors.push({
      file: filename,
      line: lines.length,
      column: 1,
      message: `Unbalanced braces: ${braceCount > 0 ? "missing" : "extra"} ${Math.abs(braceCount)} closing brace(s)`,
      severity: "error",
    })
  }

  if (bracketCount !== 0) {
    errors.push({
      file: filename,
      line: lines.length,
      column: 1,
      message: `Unbalanced brackets: ${bracketCount > 0 ? "missing" : "extra"} ${Math.abs(bracketCount)} closing bracket(s)`,
      severity: "error",
    })
  }

  if (parenCount !== 0) {
    errors.push({
      file: filename,
      line: lines.length,
      column: 1,
      message: `Unbalanced parentheses: ${parenCount > 0 ? "missing" : "extra"} ${Math.abs(parenCount)} closing paren(s)`,
      severity: "error",
    })
  }

  return errors
}

function validateJSON(filename: string, content: string): ValidationError[] {
  const errors: ValidationError[] = []

  try {
    JSON.parse(content)
  } catch (e) {
    const error = e as SyntaxError
    const match = error.message.match(/position (\d+)/)
    const position = match ? Number.parseInt(match[1]) : 0

    // Calculate line and column from position
    const lines = content.slice(0, position).split("\n")
    const line = lines.length
    const column = (lines[lines.length - 1]?.length || 0) + 1

    errors.push({
      file: filename,
      line,
      column,
      message: error.message,
      severity: "error",
    })
  }

  return errors
}

export async function POST(req: Request) {
  try {
    const { files } = (await req.json()) as { files: Record<string, string> }

    const allErrors: ValidationError[] = []

    for (const [filename, content] of Object.entries(files)) {
      // Skip binary files
      if (filename.endsWith(".png") || filename.endsWith(".ico") || filename.startsWith("data:")) {
        continue
      }

      if (filename.endsWith(".ts") || filename.endsWith(".tsx")) {
        const errors = validateTypeScript(filename, content)
        allErrors.push(...errors)
      } else if (filename.endsWith(".json")) {
        const errors = validateJSON(filename, content)
        allErrors.push(...errors)
      }
    }

    const result: ValidationResult = {
      valid: allErrors.length === 0,
      errors: allErrors,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Validation error:", error)
    return NextResponse.json(
      {
        valid: false,
        errors: [{ file: "unknown", line: 0, column: 0, message: "Validation failed", severity: "error" }],
      },
      { status: 500 },
    )
  }
}
