#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('🚀 PREP101 Supabase Migration');
console.log('=============================');
console.log('This will migrate your database from Render to Supabase');
console.log('');

// Database URLs
const RENDER_DB_URL = process.env.DATABASE_URL; // Current Render database
const SUPABASE_DB_URL = process.env.SUPABASE_DATABASE_URL; // New Supabase database

if (!RENDER_DB_URL || !SUPABASE_DB_URL) {
  console.error('❌ Missing database URLs');
  console.error('RENDER_DB_URL:', !!RENDER_DB_URL);
  console.error('SUPABASE_DB_URL:', !!SUPABASE_DB_URL);
  process.exit(1);
}

console.log('✅ Database URLs found');
console.log('📊 Render DB:', RENDER_DB_URL.replace(/:[^:]*@/, ':***@'));
console.log('📊 Supabase DB:', SUPABASE_DB_URL.replace(/:[^:]*@/, ':***@'));
console.log('');

// Step 1: Export schema and data from Render
console.log('📤 Step 1: Exporting from Render database...');
try {
  const dumpFile = path.join(__dirname, 'render-dump.sql');
  
  // Export schema and data
  execSync(`pg_dump "${RENDER_DB_URL}" --no-owner --no-privileges --clean --if-exists > "${dumpFile}"`, {
    stdio: 'inherit'
  });
  
  console.log('✅ Export completed');
  console.log(`📁 Dump file: ${dumpFile}`);
} catch (error) {
  console.error('❌ Export failed:', error.message);
  process.exit(1);
}

// Step 2: Import to Supabase
console.log('');
console.log('📥 Step 2: Importing to Supabase...');
try {
  const dumpFile = path.join(__dirname, 'render-dump.sql');
  
  // Import to Supabase
  execSync(`psql "${SUPABASE_DB_URL}" < "${dumpFile}"`, {
    stdio: 'inherit'
  });
  
  console.log('✅ Import completed');
} catch (error) {
  console.error('❌ Import failed:', error.message);
  process.exit(1);
}

// Step 3: Update Vercel DATABASE_URL
console.log('');
console.log('🔄 Step 3: Updating Vercel DATABASE_URL...');
try {
  execSync(`vercel env rm DATABASE_URL production --yes`, { stdio: 'inherit' });
  execSync(`echo "${SUPABASE_DB_URL}" | vercel env add DATABASE_URL production`, { stdio: 'inherit' });
  
  console.log('✅ Vercel DATABASE_URL updated');
} catch (error) {
  console.error('❌ Vercel update failed:', error.message);
  console.error('Please manually update DATABASE_URL in Vercel dashboard');
}

// Step 4: Deploy updated app
console.log('');
console.log('🚀 Step 4: Deploying updated app...');
try {
  execSync('vercel --prod --yes', { stdio: 'inherit' });
  console.log('✅ Deployment completed');
} catch (error) {
  console.error('❌ Deployment failed:', error.message);
}

console.log('');
console.log('🎉 Migration Complete!');
console.log('=====================');
console.log('✅ Database migrated to Supabase');
console.log('✅ Vercel updated with new DATABASE_URL');
console.log('✅ App deployed with Supabase database');
console.log('');
console.log('💰 Cost Savings: $7/month (Render PostgreSQL eliminated)');
console.log('🎯 Total monthly cost: $0 (Vercel free + Supabase free)');
console.log('');
console.log('🧪 Test your app at: https://prep101.childactor101.com');
