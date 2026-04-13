require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const { DEFAULT_CLAUDE_MODEL } = require('./config/models');
console.log("Model loading as:", DEFAULT_CLAUDE_MODEL);
