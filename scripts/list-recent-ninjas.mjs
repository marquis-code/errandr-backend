#!/usr/bin/env node

/**
 * Script to list recently joined Errand Ninjas whose profiles were approved
 * yesterday or this week.
 *
 * Usage:
 *   node scripts/list-recent-ninjas.mjs
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr';

async function main() {
  console.log('Connecting to Erranders MongoDB...');
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const errandersCol = db.collection('erranders');
  const usersCol = db.collection('users');

  const now = new Date();
  const dayOfWeek = now.getDay();
  const distanceToMonday = (dayOfWeek + 6) % 7;
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - distanceToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  const yesterdayStart = new Date(now);
  yesterdayStart.setDate(now.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);

  const yesterdayEnd = new Date(yesterdayStart);
  yesterdayEnd.setHours(23, 59, 59, 999);

  console.log(`\n========================================================================`);
  console.log(`ERRAND NINJAS APPROVED THIS WEEK (Since ${startOfWeek.toDateString()})`);
  console.log(`========================================================================\n`);

  const approvedNinjas = await errandersCol
    .find({
      verificationStatus: 'approved',
      updatedAt: { $gte: startOfWeek },
    })
    .sort({ updatedAt: -1 })
    .toArray();

  const userIds = approvedNinjas.map((e) => e.user).filter(Boolean);
  const users = await usersCol.find({ _id: { $in: userIds } }).toArray();
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const formattedList = approvedNinjas.map((errander) => {
    const user = userMap.get(String(errander.user));
    const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Unknown';
    const phone = user?.phone || 'N/A';
    const campus = errander.school || user?.school || 'Campus';
    const joined = errander.createdAt ? new Date(errander.createdAt).toISOString().split('T')[0] : 'N/A';
    const approvedAt = errander.updatedAt ? new Date(errander.updatedAt).toISOString().replace('T', ' ').slice(0, 16) : 'N/A';
    const isYesterday =
      errander.updatedAt &&
      new Date(errander.updatedAt) >= yesterdayStart &&
      new Date(errander.updatedAt) <= yesterdayEnd;

    return {
      Name: name,
      Phone: phone,
      Campus: campus,
      'Joined Date': joined,
      'Approved Time (WAT/UTC)': approvedAt,
      Window: isYesterday ? 'Yesterday' : 'Today / This Week',
      Level: `Tier ${errander.verificationLevel || 1}`,
    };
  });

  if (formattedList.length === 0) {
    console.log('No Errand Ninjas approved this week.');
  } else {
    console.table(formattedList);
  }

  console.log(`\nTotal Approved Errand Ninjas: ${formattedList.length}\n`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Error listing ninjas:', err);
  process.exit(1);
});
