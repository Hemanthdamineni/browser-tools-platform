import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './bcrypt.meta';
import bcrypt from 'bcryptjs';

/**
 * Main run function using bcryptjs
 */
async function run(input: TextRunInput): Promise<TextRunResult> {
  const { text, options } = input;
  const o = resolveOptions(meta, options);
  const mode = String(o.mode);
  const cost = Number(o.cost);
  const verifyHash = String(o.hash);
  const outputFormat = String(o.outputFormat);

  if (text === undefined) {
    return { output: '' };
  }
  if (cost < 4 || cost > 31) {
    throw new ToolError('Cost factor must be between 4 and 31');
  }

  try {
    if (mode === 'hash') {
      const result = await bcrypt.hash(text, cost);
      
      if (outputFormat === 'json') {
        return {
          output: JSON.stringify({
            hash: result,
            algorithm: 'bcrypt',
            variant: '2b',
            cost,
            salt: result.substring(7, 29),
            digest: result.substring(29),
          }, null, 2),
          render: 'code',
        };
      }
      
      return {
        output: result,
        render: 'text',
        stats: { cost, 'hash length': result.length },
      };
    } else {
      if (!verifyHash) {
        throw new ToolError('Please provide a bcrypt hash to verify against');
      }
      // Validate hash format
      if (!/^\$2[abyx]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(verifyHash)) {
        throw new ToolError('Invalid bcrypt hash format');
      }
      const matches = await bcrypt.compare(text, verifyHash);
      // Parse the hash to get cost factor
      const match = verifyHash.match(/^\$2[abyx]\$(\d{2})\$/);
      const parsedCost = match ? parseInt(match[1], 10) : cost;
      
      return {
        output: matches ? '✓ Password matches the hash' : '✗ Password does not match the hash',
        render: 'text',
        stats: {
          'cost factor': parsedCost,
          'result': matches ? 'match' : 'mismatch',
        },
      };
    }
  } catch (err) {
    if (err instanceof ToolError) throw err;
    throw new ToolError(err instanceof Error ? err.message : 'Bcrypt operation failed');
  }
}

const tool: TextToolModule = { meta, run };
export default tool;