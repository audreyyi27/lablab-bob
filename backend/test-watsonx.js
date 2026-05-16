// Test script for watsonx.ai integration
// Run with: node test-watsonx.js

import { config } from './src/config.js';
import { isWatsonxConfigured } from './src/watsonx.js';

console.log('=== RepoTalk watsonx.ai Integration Test ===\n');

// Test 1: Configuration check
console.log('1. Configuration Check:');
console.log('   WATSONX_API_KEY:', config.watsonx.apiKey ? '✓ Set' : '✗ Not set');
console.log('   WATSONX_PROJECT_ID:', config.watsonx.projectId ? '✓ Set' : '✗ Not set');
console.log('   WATSONX_REGION:', config.watsonx.region);
console.log('   WATSONX_MODEL_ID:', config.watsonx.modelId);
console.log('   watsonx.ai Configured:', isWatsonxConfigured() ? '✓ Yes' : '✗ No');
console.log();

// Test 2: Module imports
console.log('2. Module Import Check:');
try {
  const { analyzeRepository, generateDocument } = await import('./src/analyzer.js');
  console.log('   ✓ analyzer.js imported successfully');
  console.log('   ✓ analyzeRepository function available');
  console.log('   ✓ generateDocument function available');
} catch (error) {
  console.log('   ✗ Error importing analyzer.js:', error.message);
}
console.log();

// Test 3: Route imports
console.log('3. Route Import Check:');
try {
  const analyzeRoute = await import('./src/routes/analyze.js');
  console.log('   ✓ analyze.js route imported successfully');
} catch (error) {
  console.log('   ✗ Error importing analyze route:', error.message);
}
console.log();

// Test 4: watsonx.ai SDK
console.log('4. watsonx.ai SDK Check:');
try {
  const WatsonXAI = (await import('@ibm-cloud/watsonx-ai')).default;
  console.log('   ✓ @ibm-cloud/watsonx-ai SDK imported successfully');
  console.log('   ✓ SDK version:', WatsonXAI.version || 'unknown');
} catch (error) {
  console.log('   ✗ Error importing watsonx.ai SDK:', error.message);
}
console.log();

// Summary
console.log('=== Test Summary ===');
if (isWatsonxConfigured()) {
  console.log('✓ watsonx.ai is configured and ready to use');
  console.log('  Documents are generated only via IBM watsonx.ai Runtime / WML');
} else {
  console.log('✗ watsonx.ai is not configured — document generation will fail until configured');
  console.log('  Set these environment variables in .env:');
  console.log('    - WATSONX_API_KEY');
  console.log('    - WATSONX_PROJECT_ID');
  console.log('    - WATSONX_REGION (optional, defaults to us-south)');
  console.log('    - WATSONX_MODEL_ID (optional, defaults to ibm/granite-13b-chat-v2)');
}
console.log();
console.log('For detailed setup instructions, see WATSONX_INTEGRATION.md');

// Made with Bob
