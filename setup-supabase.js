#!/usr/bin/env node

/**
 * Supabase Setup Script for PREP101
 * This script helps you set up Supabase and migrate your data
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupSupabase() {
  console.log('🚀 PREP101 Supabase Setup');
  console.log('========================\n');

  console.log('This script will help you migrate from Render to Supabase.');
  console.log('You\'ll save $14/month ($7 backend + $7 database)!\n');

  // Step 1: Create Supabase project
  console.log('📋 Step 1: Create Supabase Project');
  console.log('1. Go to https://supabase.com/dashboard');
  console.log('2. Click "New Project"');
  console.log('3. Choose your organization');
  console.log('4. Enter project name: "prep101-backend"');
  console.log('5. Enter database password (save this!)');
  console.log('6. Choose a region close to your users');
  console.log('7. Click "Create new project"\n');

  await question('Press Enter when you\'ve created the Supabase project...');

  // Step 2: Get database URL
  console.log('\n📋 Step 2: Get Database URL');
  console.log('1. In your Supabase dashboard, go to Settings > Database');
  console.log('2. Scroll down to "Connection string"');
  console.log('3. Copy the "URI" connection string');
  console.log('4. It should look like: postgresql://postgres:[password]@[host]:5432/postgres\n');

  const databaseUrl = await question('Enter your Supabase DATABASE_URL: ');
  
  if (!databaseUrl.includes('supabase')) {
    console.log('⚠️  Warning: This doesn\'t look like a Supabase URL. Please double-check.');
  }

  // Step 3: Run migration
  console.log('\n📋 Step 3: Run Database Migration');
  console.log('1. In your Supabase dashboard, go to SQL Editor');
  console.log('2. Click "New query"');
  console.log('3. Copy and paste the contents of supabase-migration.sql');
  console.log('4. Click "Run" to execute the migration\n');

  await question('Press Enter when you\'ve run the migration...');

  // Step 4: Update environment variables
  console.log('\n📋 Step 4: Update Environment Variables');
  
  const envPath = path.join(__dirname, '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Update or add DATABASE_URL
  if (envContent.includes('DATABASE_URL=')) {
    envContent = envContent.replace(/DATABASE_URL=.*/, `DATABASE_URL=${databaseUrl}`);
  } else {
    envContent += `\nDATABASE_URL=${databaseUrl}\n`;
  }

  // Add Supabase-specific environment variables
  const supabaseUrl = databaseUrl.match(/postgresql:\/\/postgres:[^@]+@([^:]+):\d+\/postgres/)?.[1];
  if (supabaseUrl) {
    const projectRef = supabaseUrl.split('.')[0];
    const supabaseProjectUrl = `https://${projectRef}.supabase.co`;
    
    if (!envContent.includes('SUPABASE_URL=')) {
      envContent += `SUPABASE_URL=${supabaseProjectUrl}\n`;
    }
  }

  fs.writeFileSync(envPath, envContent);
  console.log('✅ Updated .env file with Supabase configuration');

  // Step 5: Test connection
  console.log('\n📋 Step 5: Test Database Connection');
  console.log('Testing connection to Supabase...\n');

  try {
    // Set the DATABASE_URL for testing
    process.env.DATABASE_URL = databaseUrl;
    
    const { testConnection } = require('./database/connection');
    await testConnection();
    
    console.log('✅ Database connection successful!');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('\nPlease check:');
    console.log('1. Your DATABASE_URL is correct');
    console.log('2. The migration was run successfully');
    console.log('3. Your Supabase project is active');
    return;
  }

  // Step 6: Deploy to Vercel
  console.log('\n📋 Step 6: Deploy Backend to Vercel (Free!)');
  console.log('1. Install Vercel CLI: npm i -g vercel');
  console.log('2. Run: vercel login');
  console.log('3. Run: vercel --prod');
  console.log('4. Set environment variables in Vercel dashboard\n');

  const deployNow = await question('Do you want to deploy to Vercel now? (y/n): ');
  
  if (deployNow.toLowerCase() === 'y') {
    console.log('\n🚀 Deploying to Vercel...');
    const { exec } = require('child_process');
    
    exec('vercel --prod', (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Vercel deployment failed:', error);
        console.log('Please run manually: vercel --prod');
      } else {
        console.log('✅ Deployed to Vercel!');
        console.log('Your backend URL:', stdout.trim());
      }
    });
  }

  console.log('\n🎉 Migration Complete!');
  console.log('=====================');
  console.log('✅ Database migrated to Supabase (Free tier)');
  console.log('✅ Backend ready for Vercel deployment (Free)');
  console.log('✅ Monthly cost: $0 (was $14)');
  console.log('\nNext steps:');
  console.log('1. Update your frontend to use the new backend URL');
  console.log('2. Test all functionality');
  console.log('3. Cancel your Render subscription');
  console.log('4. Enjoy the savings! 🎉');

  rl.close();
}

// Run the setup
setupSupabase().catch(console.error);
