// =============================================================================
// Demo data seeder — run with: npm run seed
// =============================================================================
// Idempotent: safe to re-run. Wipes & re-inserts demo rows scoped by stable
// demo IDs / a known set of demo emails, then re-populates them. Does NOT
// touch users outside the demo set; uses the existing admin from the DB.
// =============================================================================

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET;

if (!SUPABASE_URL || !SUPABASE_SECRET) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET in .env');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SECRET, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Stable demo IDs ────────────────────────────────────────────────────────
const ID = {
  pm:        '11111111-1111-1111-1111-111111111101',
  worker1:   '11111111-1111-1111-1111-111111111102',
  worker2:   '11111111-1111-1111-1111-111111111103',
  projNorth: '22222222-2222-2222-2222-222222222201',
  projSouth: '22222222-2222-2222-2222-222222222202',
};

const DEMO_EMAILS = [
  'pm@goolipooli.com',
  'worker1@goolipooli.com',
  'worker2@goolipooli.com',
];

// Tel Aviv area
const TLV = { lat: 32.0853, lng: 34.7818 };
function jitter(base, span = 0.05) {
  return base + (Math.random() - 0.5) * span;
}

// Calendar helpers — today is 2026-05-26 per CLAUDE.md
function isoAt(year, month, day, hour = 9, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute)).toISOString();
}

async function main() {
  console.log('→ Hashing demo password …');
  const passwordHash = await bcrypt.hash('password123', 10);

  // ── 1. Resolve an admin to act as project creator ─────────────────────────
  console.log('→ Looking up an admin user …');
  const { data: admin, error: adminErr } = await sb
    .from('users')
    .select('id, email')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();

  if (adminErr) throw adminErr;
  if (!admin) {
    console.error(
      'No admin user found. Sign up via /api/v1/auth/signup then promote with:',
    );
    console.error(
      "  update public.users set role = 'admin' where email = 'you@example.com';",
    );
    process.exit(1);
  }
  console.log(`   admin: ${admin.email} (${admin.id})`);

  // ── 2. Upsert demo users ──────────────────────────────────────────────────
  console.log('→ Upserting demo users …');
  const demoUsers = [
    {
      id: ID.pm,
      username: 'demo-pm',
      email: 'pm@goolipooli.com',
      password_hash: passwordHash,
      role: 'project_manager',
      auth_provider: 'password',
    },
    {
      id: ID.worker1,
      username: 'demo-worker-yossi',
      email: 'worker1@goolipooli.com',
      password_hash: passwordHash,
      role: 'worker',
      auth_provider: 'password',
    },
    {
      id: ID.worker2,
      username: 'demo-worker-tal',
      email: 'worker2@goolipooli.com',
      password_hash: passwordHash,
      role: 'worker',
      auth_provider: 'password',
    },
  ];

  const { error: usersErr } = await sb
    .from('users')
    .upsert(demoUsers, { onConflict: 'id' });
  if (usersErr) throw usersErr;

  // ── 3. Upsert projects ────────────────────────────────────────────────────
  console.log('→ Upserting projects …');
  const projects = [
    {
      id: ID.projNorth,
      name: 'Tel Aviv North',
      code: 'TLVNRT',
      description: 'North TLV residential pools (demo)',
      status: 'active',
      created_by: admin.id,
    },
    {
      id: ID.projSouth,
      name: 'Tel Aviv South',
      code: 'TLVSTH',
      description: 'South TLV & Yafo pools (demo)',
      status: 'active',
      created_by: admin.id,
    },
  ];
  const { error: projErr } = await sb
    .from('projects')
    .upsert(projects, { onConflict: 'id' });
  if (projErr) throw projErr;

  // ── 4. Membership ─────────────────────────────────────────────────────────
  console.log('→ Resetting memberships …');
  await sb
    .from('user_projects')
    .delete()
    .in('project_id', [ID.projNorth, ID.projSouth]);

  const memberships = [
    { user_id: admin.id, project_id: ID.projNorth, role: 'owner' },
    { user_id: admin.id, project_id: ID.projSouth, role: 'owner' },
    { user_id: ID.pm,    project_id: ID.projNorth, role: 'owner' },
    { user_id: ID.pm,    project_id: ID.projSouth, role: 'owner' },
    { user_id: ID.worker1, project_id: ID.projNorth, role: 'member' },
    { user_id: ID.worker2, project_id: ID.projSouth, role: 'member' },
    // Worker 1 also helps out in the South project so workers see >1 project
    { user_id: ID.worker1, project_id: ID.projSouth, role: 'member' },
  ];
  const { error: mErr } = await sb.from('user_projects').insert(memberships);
  if (mErr) throw mErr;

  // ── 5. Clients ────────────────────────────────────────────────────────────
  console.log('→ Resetting clients …');
  await sb
    .from('clients')
    .delete()
    .in('project_id', [ID.projNorth, ID.projSouth]);

  const northClients = [
    {
      project_id: ID.projNorth,
      name: 'Ramat Aviv Villa',
      address: 'Einstein St 42, Tel Aviv',
      phone: '+972-50-111-2201',
      gate_code: '1984',
      note: 'Two pools — main and kids',
      latitude: jitter(TLV.lat + 0.04),
      longitude: jitter(TLV.lng - 0.02),
      visits_per_month: 4,
      is_one_time: false,
      is_active: true,
      recurring_schedule: { weekdays: [1, 4], timeOfDay: '09:00', intervalWeeks: 1 },
    },
    {
      project_id: ID.projNorth,
      name: 'Tzahala Pool Club',
      address: 'Tzahala 17, Tel Aviv',
      phone: '+972-50-111-2202',
      gate_code: null,
      note: 'Service entry through side gate',
      latitude: jitter(TLV.lat + 0.05),
      longitude: jitter(TLV.lng + 0.01),
      visits_per_month: 8,
      is_one_time: false,
      is_active: true,
      recurring_schedule: { weekdays: [0, 2, 4], timeOfDay: '07:30', intervalWeeks: 1 },
    },
    {
      project_id: ID.projNorth,
      name: 'Bavli Residence',
      address: 'Bavli 8, Tel Aviv',
      phone: '+972-50-111-2203',
      gate_code: '5582',
      note: null,
      latitude: jitter(TLV.lat + 0.02),
      longitude: jitter(TLV.lng),
      visits_per_month: 4,
      is_one_time: false,
      is_active: true,
      recurring_schedule: { weekdays: [3], timeOfDay: '10:00', intervalWeeks: 1 },
    },
    {
      project_id: ID.projNorth,
      name: 'Afeka Townhouse',
      address: 'Mivtza Kadesh 3, Tel Aviv',
      phone: '+972-50-111-2204',
      gate_code: '0303',
      note: 'Dog on premises — call ahead',
      latitude: jitter(TLV.lat + 0.06),
      longitude: jitter(TLV.lng + 0.02),
      visits_per_month: 2,
      is_one_time: false,
      is_active: true,
      recurring_schedule: { weekdays: [1], timeOfDay: '11:00', intervalWeeks: 2 },
    },
  ];

  const southClients = [
    {
      project_id: ID.projSouth,
      name: 'Neve Tzedek Boutique',
      address: 'Shabazi 64, Tel Aviv',
      phone: '+972-50-111-2301',
      gate_code: '2468',
      note: 'Small spa pool',
      latitude: jitter(TLV.lat - 0.01),
      longitude: jitter(TLV.lng - 0.03),
      visits_per_month: 4,
      is_one_time: false,
      is_active: true,
      recurring_schedule: { weekdays: [2], timeOfDay: '08:00', intervalWeeks: 1 },
    },
    {
      project_id: ID.projSouth,
      name: 'Jaffa Penthouse',
      address: 'Yefet 12, Yafo',
      phone: '+972-50-111-2302',
      gate_code: '1492',
      note: null,
      latitude: jitter(TLV.lat - 0.04),
      longitude: jitter(TLV.lng - 0.04),
      visits_per_month: 4,
      is_one_time: false,
      is_active: true,
      recurring_schedule: { weekdays: [5], timeOfDay: '09:30', intervalWeeks: 1 },
    },
    {
      project_id: ID.projSouth,
      name: 'Florentin Loft',
      address: 'Florentin 22, Tel Aviv',
      phone: '+972-50-111-2303',
      gate_code: null,
      note: 'Rooftop pool — access via stairwell B',
      latitude: jitter(TLV.lat - 0.02),
      longitude: jitter(TLV.lng - 0.02),
      visits_per_month: 8,
      is_one_time: false,
      is_active: true,
      recurring_schedule: { weekdays: [0, 3], timeOfDay: '07:00', intervalWeeks: 1 },
    },
    {
      project_id: ID.projSouth,
      name: 'One-Off Bat Mitzvah Cleanup',
      address: 'Kerem HaTeimanim 5, Tel Aviv',
      phone: '+972-50-111-2304',
      gate_code: null,
      note: 'Single event clean — May 30',
      latitude: jitter(TLV.lat - 0.005),
      longitude: jitter(TLV.lng - 0.01),
      visits_per_month: 0,
      is_one_time: true,
      is_active: true,
      recurring_schedule: null,
    },
  ];

  const { data: insertedClients, error: cErr } = await sb
    .from('clients')
    .insert([...northClients, ...southClients])
    .select('id, project_id, name, latitude, longitude');
  if (cErr) throw cErr;
  console.log(`   inserted ${insertedClients.length} clients`);

  const clientsByProj = insertedClients.reduce((acc, c) => {
    (acc[c.project_id] ??= []).push(c);
    return acc;
  }, {});

  // ── 6. Visits — spread across May 2026 ────────────────────────────────────
  console.log('→ Resetting visits …');
  await sb
    .from('visits')
    .delete()
    .in('project_id', [ID.projNorth, ID.projSouth]);

  const TODAY = { year: 2026, month: 5, day: 26 };
  const visits = [];

  const workersForProj = {
    [ID.projNorth]: [ID.worker1],
    [ID.projSouth]: [ID.worker2, ID.worker1],
  };

  // For each project, walk every business day in May and assign 1-2 visits
  for (const projectId of [ID.projNorth, ID.projSouth]) {
    const projClients = clientsByProj[projectId] ?? [];
    const workers = workersForProj[projectId];

    for (let day = 1; day <= 31; day++) {
      // Skip Fridays/Saturdays (5 = Fri, 6 = Sat in JS Date for May 2026)
      const dow = new Date(Date.UTC(TODAY.year, TODAY.month - 1, day)).getUTCDay();
      if (dow === 5 || dow === 6) continue;

      // 1-2 visits per workday, rotating clients
      const count = day % 3 === 0 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const client = projClients[(day + i) % projClients.length];
        const worker = workers[(day + i) % workers.length];
        const hour = 8 + ((day + i) % 8);

        let status = 'scheduled';
        let startedAt = null;
        let completedAt = null;
        let gpsLat = null;
        let gpsLng = null;
        let gpsValidated = false;

        if (day < TODAY.day) {
          // Past — mostly completed, occasional missed
          const isMissed = (day + i) % 11 === 0;
          status = isMissed ? 'missed' : 'completed';
          if (!isMissed) {
            startedAt = isoAt(TODAY.year, TODAY.month, day, hour, 0);
            completedAt = isoAt(TODAY.year, TODAY.month, day, hour, 45);
            gpsLat = client.latitude;
            gpsLng = client.longitude;
            gpsValidated = true;
          }
        } else if (day === TODAY.day) {
          // Today — mix: one in_progress, others scheduled
          if (i === 0) {
            status = 'in_progress';
            startedAt = isoAt(TODAY.year, TODAY.month, day, hour, 0);
            gpsLat = client.latitude;
            gpsLng = client.longitude;
            gpsValidated = true;
          }
        }

        visits.push({
          project_id: projectId,
          client_id: client.id,
          worker_id: worker,
          scheduled_date: isoAt(TODAY.year, TODAY.month, day, hour, 0),
          started_at: startedAt,
          completed_at: completedAt,
          gps_latitude: gpsLat,
          gps_longitude: gpsLng,
          gps_validated: gpsValidated,
          status,
          worker_notes: status === 'completed' ? 'Pool serviced, pH within range.' : null,
          manager_notes: null,
        });
      }
    }
  }

  const { error: vErr, count: visitCount } = await sb
    .from('visits')
    .insert(visits, { count: 'exact' });
  if (vErr) throw vErr;
  console.log(`   inserted ${visitCount ?? visits.length} visits`);

  // ── 7. Notifications ──────────────────────────────────────────────────────
  console.log('→ Resetting notifications …');
  const notifTargets = [admin.id, ID.pm, ID.worker1, ID.worker2];
  await sb.from('notifications').delete().in('user_id', notifTargets);

  const notifications = [
    {
      user_id: ID.worker1,
      type: 'visit_assigned',
      title: 'New visit assigned',
      message: 'Ramat Aviv Villa — tomorrow 09:00',
      read: false,
    },
    {
      user_id: ID.worker1,
      type: 'schedule_changed',
      title: 'Schedule changed',
      message: 'Tzahala Pool Club moved from 07:30 to 08:00',
      read: false,
    },
    {
      user_id: ID.worker2,
      type: 'visit_assigned',
      title: 'New visit assigned',
      message: 'Florentin Loft — today 14:00',
      read: false,
    },
    {
      user_id: admin.id,
      type: 'visit_missed',
      title: 'Visit missed',
      message: 'Bavli Residence — worker did not check in',
      read: false,
    },
    {
      user_id: admin.id,
      type: 'project_created',
      title: 'Demo data loaded',
      message: 'Tel Aviv North & Tel Aviv South demo data ready',
      read: true,
    },
  ];
  const { error: nErr } = await sb.from('notifications').insert(notifications);
  if (nErr) throw nErr;

  console.log('');
  console.log('✓ Done.');
  console.log('');
  console.log('Demo login credentials (password for all: "password123"):');
  console.log('  Project Manager: pm@goolipooli.com');
  console.log('  Worker 1:        worker1@goolipooli.com');
  console.log('  Worker 2:        worker2@goolipooli.com');
  console.log('');
  console.log('Demo accounts list:');
  console.log(`  Demo project IDs: ${ID.projNorth} (North), ${ID.projSouth} (South)`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
