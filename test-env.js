const path = require('path');

console.log('=== Environment Test ===');
console.log('Current directory:', process.cwd());

// Try loading dotenv
require('dotenv').config();

console.log('DATABASE_URL after dotenv:', !!process.env.DATABASE_URL);

// Try loading from explicit path
require('dotenv').config({ path: './.env' });
console.log('DATABASE_URL after explicit path:', !!process.env.DATABASE_URL);

// Show all env vars that contain 'DATA'
const dataVars = Object.keys(process.env).filter(key => 
  key.includes('DATA') || key.includes('POSTGRES')
);
console.log('Environment variables with DATA/POSTGRES:', dataVars);

// Check if .env file exists
const fs = require('fs');
const envExists = fs.existsSync('./.env');
console.log('.env file exists:', envExists);

if (envExists) {
  const envContent = fs.readFileSync('./.env', 'utf8');
  console.log('.env file size:', envContent.length, 'characters');
  console.log('Contains DATABASE_URL:', envContent.includes('DATABASE_URL'));
}
