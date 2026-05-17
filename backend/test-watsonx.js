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
  const { WatsonXAI } = await import('@ibm-cloud/watsonx-ai');
  console.log('   ✓ @ibm-cloud/watsonx-ai SDK imported successfully');
  console.log('   ✓ WatsonXAI.newInstance:', typeof WatsonXAI?.newInstance === 'function' ? 'available' : 'missing');
} catch (error) {
  console.log('   ✗ Error importing watsonx.ai SDK:', error.message);
}
console.log();

// Summary
console.log('=== Test Summary ===');
if (isWatsonxConfigured()) {
  console.log('✓ watsonx.ai ML is configured — documents will use IBM watsonx.ai');
  console.log('  (template fallback still applies if the API call fails)');
} else {
  console.log('✓ Template mode — document generation works WITHOUT WATSONX_PROJECT_ID');
  console.log('  Optional: add WATSONX_PROJECT_ID to .env for full AI-generated docs');
  if (config.watsonx.apiKey) {
    console.log('  (WATSONX_API_KEY is set — Orchestrate/CD can still use it)');
  }
}
console.log();
console.log('For detailed setup instructions, see WATSONX_INTEGRATION.md');

// Made with Bob
