export function hasFlag(argv: readonly string[], name: string): boolean {
  return argv.includes(`--${name}`);
}

export function readFlagValue(argv: readonly string[], name: string): string | undefined {
  const prefixed = `--${name}=`;
  const withEquals = argv.find((entry) => entry.startsWith(prefixed));
  if (withEquals) return withEquals.slice(prefixed.length);

  const index = argv.indexOf(`--${name}`);
  if (index === -1) return undefined;

  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) return undefined;
  return value;
}

export function readCsvFlag(argv: readonly string[], name: string): string[] | undefined {
  const value = readFlagValue(argv, name);
  if (!value) return undefined;
  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return entries.length > 0 ? entries : undefined;
}
