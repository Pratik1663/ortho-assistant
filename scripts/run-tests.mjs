import ts from 'typescript'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
const files = ['src/formOptions.ts', 'src/prescriptionState.ts', 'src/chatStream.ts', 'api/chat.ts', 'src/components/MessageList.tsx', 'src/components/PrescriptionPanel.tsx']
try {
  for (const file of files) {
    const output = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX }
    }).outputText.replace(/require\("(\.[^"]+)"\)/g, 'require("$1.cjs")')
    const target = `.test-build/${file.replace(/\.tsx?$/, '.cjs')}`
    mkdirSync(target.slice(0, target.lastIndexOf('/')), { recursive: true })
    writeFileSync(target, output)
  }
  const result = spawnSync(process.execPath, ['--test', 'tests/regression.test.cjs'], { stdio: 'inherit' })
  process.exitCode = result.status ?? 1
} finally {
  rmSync('.test-build', { recursive: true, force: true })
}
