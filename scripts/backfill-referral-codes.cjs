/**
 * Gives every student a referral code in the ERR-SURNAME format.
 *
 * Dry run by default — prints what would change without writing. Pass --apply to commit.
 *
 * Existing codes are replaced, because the point is one consistent format. That means any code
 * already shared with someone will stop working, which is why this prints the old values first.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

const base = (surname) => {
  const cleaned = String(surname || '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 14);
  return `ERR-${cleaned || 'USER'}`;
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = mongoose.connection.db.collection('users');

  const students = await users
    .find({ role: 'student' })
    .project({ firstName: true, lastName: true, referralCode: true })
    .sort({ createdAt: 1 })
    .toArray();

  // Reserve the codes that are already correct so two students never share one.
  const taken = new Set();
  for (const u of students) {
    if (u.referralCode && u.referralCode === base(u.lastName || u.firstName)) taken.add(u.referralCode);
  }

  const changes = [];
  for (const u of students) {
    const b = base(u.lastName || u.firstName);
    if (u.referralCode === b) continue;

    let candidate = b;
    let n = 2;
    while (taken.has(candidate)) candidate = `${b}${n++}`;
    taken.add(candidate);

    changes.push({ id: u._id, name: `${u.firstName || ''} ${u.lastName || ''}`.trim(), from: u.referralCode || null, to: candidate });
  }

  console.log(`  students          : ${students.length}`);
  console.log(`  already correct   : ${students.length - changes.length}`);
  console.log(`  to change         : ${changes.length}`);
  for (const c of changes.slice(0, 12)) {
    console.log(`    ${String(c.name || '?').padEnd(24)} ${String(c.from || '(none)').padEnd(18)} -> ${c.to}`);
  }
  if (changes.length > 12) console.log(`    … and ${changes.length - 12} more`);

  if (!APPLY) {
    console.log('\n  dry run — nothing written. re-run with --apply');
  } else {
    // Two passes. referralCode is uniquely indexed, so writing a new value while the previous
    // holder still has it is a duplicate-key error — exactly what happened on the first attempt.
    // Park every changing record on a guaranteed-unique placeholder first, then assign.
    for (const c of changes) {
      await users.updateOne(
        { _id: c.id },
        { $set: { referralCode: `TMP-${String(c.id).slice(-8).toUpperCase()}` } },
      );
    }
    for (const c of changes) {
      await users.updateOne({ _id: c.id }, { $set: { referralCode: c.to, updatedAt: new Date() } });
    }
    console.log(`\n  applied: ${changes.length} updated`);
  }

  const after = await users.countDocuments({ role: 'student', referralCode: { $exists: true, $nin: [null, ''] } });
  const total = await users.countDocuments({ role: 'student' });
  const dupes = await users
    .aggregate([
      { $match: { role: 'student', referralCode: { $nin: [null, ''] } } },
      { $group: { _id: '$referralCode', c: { $sum: 1 } } },
      { $match: { c: { $gt: 1 } } },
    ])
    .toArray();

  console.log(`  with a code       : ${after}/${total}`);
  console.log(`  duplicates        : ${dupes.length}`);
  await mongoose.disconnect();
})();
