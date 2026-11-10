// Publish firebase/firestore.rules to the santa-pack Firestore database.
// Ported from rosemont-club scripts/deploy-rules.py: it uses your gcloud login
// and the Firebase Rules REST API, so firebase-tools needs no separate login.
//
//   node scripts/deploy-rules.mjs            # show what would be published
//   node scripts/deploy-rules.mjs --apply    # publish
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? 'hopeful-machine-466912-t2';
const DATABASE = process.env.FIRESTORE_DATABASE ?? 'santa-pack';
const apply = process.argv.includes('--apply');

const source = readFileSync(new URL('../firebase/firestore.rules', import.meta.url), 'utf8');
console.log(`Project ${PROJECT}, database ${DATABASE}${apply ? '' : ' (dry run; pass --apply to publish)'}`);
console.log(source);
if (!apply) process.exit(0);

const token = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
const headers = {
  Authorization: `Bearer ${token}`,
  'x-goog-user-project': PROJECT,
  'Content-Type': 'application/json',
};
const base = `https://firebaserules.googleapis.com/v1/projects/${PROJECT}`;

/** @param {string} url @param {RequestInit} init */
async function call(url, init) {
  const response = await fetch(url, { ...init, headers });
  const body = await response.json();
  return { status: response.status, body };
}

const ruleset = await call(`${base}/rulesets`, {
  method: 'POST',
  body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: source }] } }),
});
if (ruleset.status !== 200) throw new Error(`Creating the ruleset failed: ${JSON.stringify(ruleset.body)}`);
const rulesetName = ruleset.body.name;

const releaseName = `projects/${PROJECT}/releases/cloud.firestore/${DATABASE}`;
let release = await call(`${base}/releases`, {
  method: 'POST',
  body: JSON.stringify({ name: releaseName, rulesetName }),
});
if (release.status === 409) {
  release = await call(`https://firebaserules.googleapis.com/v1/${releaseName}`, {
    method: 'PATCH',
    body: JSON.stringify({ release: { name: releaseName, rulesetName } }),
  });
}
if (release.status !== 200) throw new Error(`Publishing the release failed: ${JSON.stringify(release.body)}`);
console.log(`Published ${rulesetName} as ${releaseName}`);
