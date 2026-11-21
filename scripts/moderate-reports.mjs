import { readFileSync } from 'node:fs';

const env = { ...process.env };
for (const file of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !env[match[1]]) env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch {
    /* file is optional */
  }
}

const token = (env.SUPABASE_ACCESS_TOKEN || '').trim();
const project = (env.SUPABASE_PROJECT_ID || '').trim();
const statuses = ['open', 'reviewing', 'resolved', 'dismissed'];

if (!token || !project) {
  console.error('Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_ID.');
  console.error('Add them to .env.local (never commit them) and rerun.');
  process.exit(2);
}

function usage() {
  console.log(`Content report moderation

Usage:
  npm run reports -- list [open|reviewing|resolved|dismissed|all] [limit]
  npm run reports -- resolve <id> <open|reviewing|resolved|dismissed> [note]

Examples:
  npm run reports -- list open
  npm run reports -- resolve 42 resolved "Place name corrected in the next content pass"
`);
}

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'yaounde-life-moderation',
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`Management API ${res.status}: ${detail}`);
  }
  return body;
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function firstRow(body) {
  return Array.isArray(body) ? body[0] : body;
}

async function listReports(status, limit) {
  if (status !== 'all' && !statuses.includes(status)) {
    console.error(`Unknown status "${status}". Use open, reviewing, resolved, dismissed or all.`);
    process.exit(2);
  }
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const where = status === 'all' ? '' : `where status = ${sqlLiteral(status)}`;
  const sql = `
    select coalesce(
      json_agg(row_to_json(r) order by created_at desc),
      '[]'::json
    ) as reports
    from (
      select id, status, kind, payload, created_at, reviewed_at, resolution
      from public.reports
      ${where}
      order by created_at desc
      limit ${safeLimit}
    ) r;
  `;
  const rows = firstRow(await query(sql))?.reports ?? [];
  if (rows.length === 0) {
    console.log(`No ${status === 'all' ? '' : `${status} `}reports.`);
    return;
  }
  for (const row of rows) {
    const payload = row.payload ?? {};
    const ref = payload.refId ?? payload.reportId ?? '';
    const when = new Date(row.created_at).toISOString().slice(0, 16).replace('T', ' ');
    console.log(`#${row.id} [${row.status}] ${when} ${row.kind}${ref ? ` ${ref}` : ''}`);
    if (payload.note) console.log(`  ${payload.note}`);
    if (row.resolution) console.log(`  resolution: ${row.resolution}`);
  }
}

async function resolveReport(rawId, status, note) {
  if (!statuses.includes(status)) {
    console.error(`Unknown status "${status}". Use open, reviewing, resolved or dismissed.`);
    process.exit(2);
  }
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    console.error('Report id must be a positive integer.');
    process.exit(2);
  }
  const resolution = note.trim() ? sqlLiteral(note.trim()) : 'null';
  const sql = `
    select row_to_json(public.resolve_content_report(${id}, ${sqlLiteral(status)}, ${resolution})) as report;
  `;
  const report = firstRow(await query(sql))?.report;
  if (!report) {
    console.error(`Report #${id} was not returned.`);
    process.exit(1);
  }
  console.log(`#${report.id} -> ${report.status}${report.resolution ? ` · ${report.resolution}` : ''}`);
}

const [command = 'list', ...args] = process.argv.slice(2);
if (command === 'help' || command === '--help' || command === '-h') {
  usage();
} else if (command === 'list') {
  await listReports(args[0] ?? 'open', args[1] ?? 50);
} else if (command === 'resolve') {
  if (!args[0] || !args[1]) {
    usage();
    process.exit(2);
  }
  await resolveReport(args[0], args[1], args.slice(2).join(' '));
} else {
  usage();
  process.exit(2);
}
