#!/usr/bin/env node

/**
 * Migration script to add discountPercent column to PromoCodeRedemptions table
 * Run this script to update your production database schema
 * 
 * Usage: node scripts/add-discount-percent-column.js
 */

const { Sequelize } = require('sequelize');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

async function runMigration() {
  let sequelize = null;
  
  try {
    // Parse the database URL
    const url = new URL(databaseUrl);
    const isSupabase = url.hostname.includes('supabase') || url.hostname.includes('supabase.co');
    
    sequelize = new Sequelize(databaseUrl, {
      dialect: 'postgres',
      protocol: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      logging: console.log
    });

    console.log('🔧 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // Check if column exists
    const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'PromoCodeRedemptions' 
      AND column_name = 'discountPercent'
    `);

    if (results.length > 0) {
      console.log('✅ Column discountPercent already exists');
    } else {
      console.log('🔧 Adding discountPercent column...');
      await sequelize.query(`
        ALTER TABLE "PromoCodeRedemptions" 
        ADD COLUMN "discountPercent" INTEGER DEFAULT 0
      `);
      console.log('✅ Added discountPercent column');
    }

    // Check and add other missing columns
    const columnsToAdd = [
      { name: 'expiresAt', type: 'TIMESTAMP', nullable: true },
      { name: 'isUsed', type: 'BOOLEAN', nullable: true, default: 'false' },
      { name: 'usedAt', type: 'TIMESTAMP', nullable: true },
      { name: 'createdAt', type: 'TIMESTAMP', nullable: true, default: 'now()' },
      { name: 'updatedAt', type: 'TIMESTAMP', nullable: true, default: 'now()' }
    ];

    for (const col of columnsToAdd) {
      const [checkResults] = await sequelize.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'PromoCodeRedemptions' 
        AND column_name = '${col.name}'
      `);

      if (checkResults.length === 0) {
        console.log(`🔧 Adding ${col.name} column...`);
        const nullable = col.nullable ? '' : 'NOT NULL';
        const defaultVal = col.default ? `DEFAULT ${col.default}` : '';
        await sequelize.query(`
          ALTER TABLE "PromoCodeRedemptions" 
          ADD COLUMN "${col.name}" ${col.type} ${nullable} ${defaultVal}
        `);
        console.log(`✅ Added ${col.name} column`);
      } else {
        console.log(`✅ Column ${col.name} already exists`);
      }
    }

    console.log('🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (sequelize) {
      await sequelize.close();
      console.log('✅ Database connection closed');
    }
  }
}

runMigration();

