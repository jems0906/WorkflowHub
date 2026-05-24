import bcrypt from 'bcryptjs';
import { pool } from './pool';

async function seed() {
  const client = await pool.connect();
  try {
    // Create admin
    const adminHash = await bcrypt.hash('Admin123!', 12);
    await client.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      ['Admin User', 'admin@workflowhub.local', adminHash, 'admin']
    );

    // Create reviewer
    const reviewerHash = await bcrypt.hash('Review123!', 12);
    await client.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      ['Jane Reviewer', 'reviewer@workflowhub.local', reviewerHash, 'reviewer']
    );

    // Create regular user
    const userHash = await bcrypt.hash('User1234!', 12);
    await client.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      ['John User', 'user@workflowhub.local', userHash, 'user']
    );

    console.log('✅ Seed complete');
    console.log('   admin@workflowhub.local     / Admin123!');
    console.log('   reviewer@workflowhub.local  / Review123!');
    console.log('   user@workflowhub.local      / User1234!');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
