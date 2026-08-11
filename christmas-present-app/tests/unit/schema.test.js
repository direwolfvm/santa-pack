const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20260811000000_baseline.sql'), 'utf8');

test('baseline defines every table used by the application', () => {
  for (const table of ['profiles', 'family', 'person', 'gift_round', 'present']) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}\\b`));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
});

test('baseline constrains roles, stages, self-gifting, and duplicate gifts', () => {
  assert.match(migration, /role in \('user', 'manager', 'admin'\)/);
  assert.match(migration, /stage in \('giving', 'guessing', 'complete'\)/);
  assert.match(migration, /check \(giver <> receiver\)/);
  assert.match(migration, /unique \(gift_round, giver, receiver\)/);
});

test('baseline includes family-scoped policy helpers', () => {
  assert.match(migration, /function public\.is_family_member/);
  assert.match(migration, /function public\.can_manage_family/);
  assert.match(migration, /family managers create gift rounds/);
  assert.match(migration, /participants or managers update presents/);
  assert.match(migration, /function public\.protect_profile_role/);
  assert.match(migration, /function public\.protect_person_membership/);
  assert.match(migration, /function public\.validate_present_family/);
});
