require('dotenv').config();
const { sequelize } = require('../database/connection');
const PromoCode = require('../models/PromoCode');

async function createClassPromo() {
    try {
        console.log('🔄 Connecting to database...');
        await sequelize.authenticate();
        console.log('✅ Connected');

        // Calculate 5 months from now
        const fiveMonthsFromNow = new Date();
        fiveMonthsFromNow.setMonth(fiveMonthsFromNow.getMonth() + 5);

        const codeData = {
            code: 'CLASS2026', // Code for the students
            description: 'Unlimited access for 5 months for class students',
            type: 'free_guides',
            guidesGranted: 5000, // Effectively unlimited
            maxRedemptions: null, // Unlimited number of students can use it
            maxRedemptionsPerUser: 1, // Each student redeems once
            expiresAt: fiveMonthsFromNow,
            isActive: true,
            notes: 'Created for class students - 5 months unlimited access'
        };

        const [code, created] = await PromoCode.findOrCreate({
            where: { code: codeData.code },
            defaults: codeData
        });

        if (created) {
            console.log(`✅ Created Code: ${code.code}`);
        } else {
            console.log(`ℹ️  Code ${code.code} already exists. Updating...`);
            await code.update(codeData);
            console.log(`✅ Updated Code: ${code.code}`);
        }

        console.log('Details:');
        console.log(`- Guides per user: ${codeData.guidesGranted}`);
        console.log(`- Expires: ${codeData.expiresAt}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await sequelize.close();
    }
}

createClassPromo();
