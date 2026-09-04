import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './gitignore.meta';

const GENERAL = [
  '.DS_Store',
  'Thumbs.db',
  '*.log',
  '.idea/',
  '.vscode/*',
  '!.vscode/extensions.json',
];

const STACKS: Record<string, string[]> = {
  node: [
    'node_modules/',
    'dist/',
    'build/',
    '.env',
    '.env.*',
    '!.env.example',
    'coverage/',
    'npm-debug.log*',
    'yarn-error.log*',
    '.pnpm-debug.log*',
  ],
  python: [
    '__pycache__/',
    '*.py[cod]',
    '.venv/',
    'venv/',
    'dist/',
    'build/',
    '*.egg-info/',
    '.pytest_cache/',
    '.mypy_cache/',
    '.env',
    '!.env.example',
  ],
  rust: ['/target', 'Cargo.lock', '**/*.rs.bk'],
  go: ['/bin/', '/pkg/', '*.test', '*.out', 'vendor/'],
  'java-maven': [
    'target/',
    '*.class',
    '*.jar',
    '*.war',
    '.mvn/wrapper/maven-wrapper.jar',
    '.gradle/',
  ],
  macos: ['.DS_Store', '._*', '.Spotlight-V100', '.Trashes', '.AppleDouble', '.LSOverride'],
  windows: ['Thumbs.db', 'ehthumbs.db', 'Desktop.ini', '$RECYCLE.BIN/', '*.lnk'],
  linux: ['*~', '.fuse_hidden*', '.directory', '.Trash-*', '.nfs*'],
  jetbrains: ['.idea/', '*.iml', '*.ipr', '*.iws', 'out/'],
  vscode: ['.vscode/*', '!.vscode/extensions.json', '!.vscode/settings.json', 'history/'],
  general: [],
};

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const stack = String(o.stack);
  const seen = new Set<string>();
  const lines: string[] = [];
  const add = (line: string) => {
    if (!seen.has(line)) {
      seen.add(line);
      lines.push(line);
    }
  };
  for (const line of STACKS[stack] ?? []) add(line);
  if (stack !== 'general') for (const line of GENERAL) add(line);
  return { output: lines.join('\n') + '\n', render: 'code', language: 'gitignore' };
}

const tool: TextToolModule = { meta, run };
export default tool;
