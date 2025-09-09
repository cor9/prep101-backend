#!/usr/bin/env node

/**
 * Vercel Deployment Script for PREP101
 * Deploys to Vercel while keeping existing Render database
 */

const { exec } = require('child_process');
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

async function deployToVercel() {
  console.log('🚀 PREP101 Vercel Deployment');
  console.log('============================\n');

  console.log('This will deploy your backend to Vercel while keeping your existing Render database.');
  console.log('This is a safe migration approach - no data risk!\n');

  // Check if Vercel CLI is installed
  console.log('📋 Step 1: Check Vercel CLI');
  try {
    await new Promise((resolve, reject) => {
      exec('vercel --version', (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          console.log('✅ Vercel CLI found:', stdout.trim());
          resolve();
        }
      });
    });
  } catch (error) {
    console.log('❌ Vercel CLI not found. Installing...');
    try {
      await new Promise((resolve, reject) => {
        exec('npm install -g vercel', (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            console.log('✅ Vercel CLI installed');
            resolve();
          }
        });
      });
    } catch (installError) {
      console.error('❌ Failed to install Vercel CLI:', installError.message);
      console.log('Please install manually: npm install -g vercel');
      return;
    }
  }

  // Check if user is logged in
  console.log('\n📋 Step 2: Check Vercel Login');
  try {
    await new Promise((resolve, reject) => {
      exec('vercel whoami', (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          console.log('✅ Logged in as:', stdout.trim());
          resolve();
        }
      });
    });
  } catch (error) {
    console.log('❌ Not logged in to Vercel. Please login...');
    try {
      await new Promise((resolve, reject) => {
        exec('vercel login', (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            console.log('✅ Logged in to Vercel');
            resolve();
          }
        });
      });
    } catch (loginError) {
      console.error('❌ Login failed:', loginError.message);
      console.log('Please run: vercel login');
      return;
    }
  }

  // Check environment variables
  console.log('\n📋 Step 3: Check Environment Variables');
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env file not found. Please create one with your environment variables.');
    return;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const requiredVars = ['DATABASE_URL', 'JWT_SECRET', 'ANTHROPIC_API_KEY'];
  const missingVars = requiredVars.filter(varName => !envContent.includes(`${varName}=`));

  if (missingVars.length > 0) {
    console.log('❌ Missing required environment variables:', missingVars.join(', '));
    console.log('Please add them to your .env file');
    return;
  }

  console.log('✅ Environment variables found');

  // Deploy to Vercel
  console.log('\n📋 Step 4: Deploy to Vercel');
  console.log('Deploying your backend to Vercel...\n');

  try {
    await new Promise((resolve, reject) => {
      const deployProcess = exec('vercel --prod --yes', (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          console.log('✅ Deployment successful!');
          console.log('Backend URL:', stdout.trim());
          resolve();
        }
      });

      deployProcess.stdout.on('data', (data) => {
        console.log(data.toString());
      });

      deployProcess.stderr.on('data', (data) => {
        console.log(data.toString());
      });
    });
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    console.log('Please check the error above and try again');
    return;
  }

  // Set environment variables in Vercel
  console.log('\n📋 Step 5: Set Environment Variables in Vercel');
  console.log('You need to set these environment variables in your Vercel dashboard:');
  console.log('1. Go to https://vercel.com/dashboard');
  console.log('2. Select your project');
  console.log('3. Go to Settings > Environment Variables');
  console.log('4. Add these variables:');
  
  const envVars = [
    'DATABASE_URL',
    'JWT_SECRET', 
    'ANTHROPIC_API_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'FRONTEND_URL'
  ];

  envVars.forEach(varName => {
    if (envContent.includes(`${varName}=`)) {
      const value = envContent.match(new RegExp(`${varName}=(.+)`))?.[1];
      console.log(`   ${varName}=${value ? '***' : 'NOT_SET'}`);
    }
  });

  console.log('\n📋 Step 6: Test Your Deployment');
  console.log('Test your Vercel deployment:');
  console.log('1. Health check: curl https://your-app.vercel.app/health');
  console.log('2. Test API endpoints');
  console.log('3. Update your frontend to use the new URL');

  console.log('\n🎉 Vercel Deployment Complete!');
  console.log('==============================');
  console.log('✅ Backend deployed to Vercel (free)');
  console.log('✅ Still using Render database (safe)');
  console.log('✅ Ready for Supabase migration next');
  console.log('\nNext steps:');
  console.log('1. Test the Vercel deployment');
  console.log('2. Update your frontend URL');
  console.log('3. When ready, migrate to Supabase database');

  rl.close();
}

// Run the deployment
deployToVercel().catch(console.error);
