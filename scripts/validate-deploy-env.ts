function parseNodeVersion(version: string): [number, number, number] {
  const [major = '0', minor = '0', patch = '0'] = version.split('.');
  return [Number(major), Number(minor), Number(patch)];
}

function isNodeVersionAtLeast(min: [number, number, number]): boolean {
  const current = parseNodeVersion(process.versions.node);
  for (let i = 0; i < 3; i += 1) {
    if (current[i] > min[i]) return true;
    if (current[i] < min[i]) return false;
  }
  return true;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function assertNodeVersion() {
  const minimum: [number, number, number] = [22, 12, 0];
  if (isNodeVersionAtLeast(minimum)) return;
  console.error(
    `deploy config validation failed: Node ${minimum.join('.')}+ required, current is ${process.versions.node}`,
  );
  process.exit(1);
}

function assertPagesEnv() {
  const isPagesBuild = process.env.CF_PAGES === '1';
  if (!isPagesBuild) return;

  const requiredVars = ['FORMSPREE_FORM_ID', 'PUBLIC_SITE_URL'] as const;
  const missing = requiredVars.filter((name) => !String(process.env[name] ?? '').trim());
  if (missing.length > 0) {
    console.error(`deploy config validation failed: missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  const siteUrl = String(process.env.PUBLIC_SITE_URL || '').trim();
  if (!isValidHttpUrl(siteUrl)) {
    console.error('deploy config validation failed: PUBLIC_SITE_URL must be a valid http(s) URL');
    process.exit(1);
  }
}

assertNodeVersion();
assertPagesEnv();
console.log('deploy config validation passed');
