require('dotenv').config();
const mongoose = require('mongoose');
const AdminUser = require('../src/models/AdminUser');

/**
 * Run this ONCE to create your first superadmin account:
 *   node scripts/createSuperAdmin.js "Your Name" you@example.com "a-strong-password"
 *
 * There is no public /register endpoint for admins on purpose — this
 * keeps the Admin Dashboard from ever being reachable by a random
 * app user, exactly as requested.
 */
const run = async () => {
  const [, , name, email, password] = process.argv;

  if (!name || !email || !password) {
    console.error('Usage: node scripts/createSuperAdmin.js "Full Name" email@example.com yourPassword');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const existing = await AdminUser.findOne({ email: email.toLowerCase() });
  if (existing) {
    console.log('An admin with this email already exists.');
    process.exit(0);
  }

  const admin = await AdminUser.create({
    name,
    email: email.toLowerCase(),
    password,
    role: 'superadmin',
    permissions: ['*'],
  });

  console.log(`Superadmin created: ${admin.email} (id: ${admin._id})`);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
