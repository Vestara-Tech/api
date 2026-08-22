import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config/schema.js';

interface ExampleScriptOptions {
  configPath?: string;
  verbose?: boolean;
  dryRun?: boolean;
}

async function main(options: ExampleScriptOptions = {}): Promise<void> {
  const { verbose = false, dryRun = false } = options;

  if (verbose) {
    console.log('Starting example script...');
    console.log(`Working directory: ${process.cwd()}`);
  }

  // Load configuration using existing config loader
  const config = loadConfig({});

  if (verbose) {
    console.log('Configuration loaded:', JSON.stringify(config, null, 2));
  }

  // Example: Resolve paths relative to repo root
  const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..');
  const outputDir = resolve(repoRoot, 'output');

  if (verbose) {
    console.log(`Repository root: ${repoRoot}`);
    console.log(`Output directory: ${outputDir}`);
  }

  if (dryRun) {
    console.log('DRY RUN: No changes will be made');
    return;
  }

  // Your script logic here
  console.log('Example script completed successfully');
}

function parseArgs(): ExampleScriptOptions {
  const args = process.argv.slice(2);
  const options: ExampleScriptOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--dry-run':
      case '-n':
        options.dryRun = true;
        break;
      case '--config':
        options.configPath = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: tsx scripts/example-script.ts [options]

Options:
  -v, --verbose     Enable verbose output
  -n, --dry-run     Run without making changes
  --config <path>   Path to config file
  -h, --help        Show this help message
        `);
        process.exit(0);
      default:
        console.error(`Unknown argument: ${arg}`);
        process.exit(1);
    }
  }

  return options;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const options = parseArgs();
  void main(options).catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}