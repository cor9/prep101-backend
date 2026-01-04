const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:5001/api';
const PDF_PATH = './node_modules/pdf-parse/test/data/01-valid.pdf';

async function runTest() {
  try {
    // 1. Upload PDF
    console.log('📄 Uploading PDF...');
    if (!fs.existsSync(PDF_PATH)) {
        console.error(`❌ PDF not found at ${PDF_PATH}`);
        return;
    }

    const form = new FormData();
    form.append('file', fs.createReadStream(PDF_PATH));

    const uploadRes = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      body: form
    });

    if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.statusText}`);
    const uploadData = await uploadRes.json();
    console.log('✅ Upload successful:', uploadData.uploadId);

    // 2. Test Models
    const models = ['Claude 3.5 Sonnet', 'GPT-4o', 'Gemini 1.5 Flash'];

    for (const model of models) {
      console.log(`\n🧪 Testing generation with ${model}...`);

      const generateRes = await fetch(`${API_URL}/guides/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId: uploadData.uploadId,
          characterName: 'Test Character',
          productionTitle: 'Test Production',
          productionType: 'Drama',
          model: model
        })
      });

      if (generateRes.ok) {
        const result = await generateRes.json();
        console.log(`✅ Success with ${model}! Guide length: ${result.guideContent.length}`);
      } else {
        const error = await generateRes.json();
        console.log(`❌ Failed with ${model}:`, error.error || error);
        console.log('   (This is expected if API keys are missing)');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

runTest();
