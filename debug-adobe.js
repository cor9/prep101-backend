const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Test Adobe extractor with a sample PDF
async function debugAdobe() {
  try {
    console.log('🔍 Debugging Adobe Extractor...');
    
    // Check if Adobe is enabled
    const ADOBE_ENABLED = process.env.ADOBE_PDF_EXTRACT_ENABLED === 'true';
    console.log('Adobe enabled:', ADOBE_ENABLED);
    
    if (!ADOBE_ENABLED) {
      console.log('❌ Adobe extractor is disabled');
      return;
    }
    
    // Check credentials file
    const credentialsPath = process.env.ADOBE_PDF_CREDENTIALS_PATH || './pdfservices-api-credentials.json';
    console.log('Credentials path:', credentialsPath);
    
    if (!fs.existsSync(credentialsPath)) {
      console.log('❌ Credentials file not found');
      return;
    }
    
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    console.log('✅ Credentials loaded:', {
      hasClientId: !!credentials.client_credentials?.client_id,
      hasClientSecret: !!credentials.client_credentials?.client_secret,
      hasOrgId: !!credentials.service_principal_credentials?.organization_id
    });
    
    // Test SDK imports
    try {
      const {
        ServicePrincipalCredentials,
        PDFServices,
        MimeType,
        ExtractPDFJob,
        ExtractPDFParams,
        ExtractElementType,
        PDFServicesResponse,
      } = require('@adobe/pdfservices-node-sdk');
      
      console.log('✅ SDK imports successful');
      console.log('ExtractElementType.TEXT:', ExtractElementType.TEXT);
      console.log('ExtractElementType.TABLES:', ExtractElementType.TABLES);
      
      // Test creating credentials
      const creds = new ServicePrincipalCredentials({
        clientId: credentials.client_credentials.client_id,
        clientSecret: credentials.client_credentials.client_secret,
      });
      console.log('✅ Credentials object created successfully');
      
      // Test creating PDFServices
      const pdfServices = new PDFServices({ credentials: creds });
      console.log('✅ PDFServices object created successfully');
      
    } catch (importError) {
      console.log('❌ SDK import failed:', importError.message);
      return;
    }
    
    console.log('✅ Adobe extractor debug completed successfully');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugAdobe();
