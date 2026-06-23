import axios from 'axios';
import { askLuminineAI, resetHistory } from './llm.js';
import ora from 'ora';
import assert from 'assert';

async function runTest() {
  console.log('🔄 Starting tool calling integration test for askLuminineAI...');

  let callCount = 0;
  let receivedToolResult = false;

  // Configure custom Axios adapter to mock the API requests/responses
  axios.interceptors.request.use((config) => {
    config.adapter = async (cfg) => {
      callCount++;
      const body = JSON.parse(cfg.data || '{}');

      if (callCount === 1) {
        console.log('  [Mock Server] Received first request. Simulating a tool call to "listFiles"...');
        return {
          data: {
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: 'I will list the TS files to see what we have.',
                  tool_calls: [
                    {
                      id: 'call_abc123',
                      type: 'function',
                      function: {
                        name: 'listFiles',
                        arguments: JSON.stringify({ pattern: 'src/*.ts' })
                      }
                    }
                  ]
                }
              }
            ]
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: cfg
        } as any;
      } else if (callCount === 2) {
        console.log('  [Mock Server] Received second request. Checking if tool result was returned...');
        
        // Find the tool response message in the messages list
        const toolMsg = body.messages?.find((m: any) => m.role === 'tool' && m.tool_call_id === 'call_abc123');
        if (toolMsg) {
          console.log(`  [Mock Server] Success! Received tool result message:`, toolMsg);
          receivedToolResult = true;
        }

        return {
          data: {
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: 'Perfect, I see the TS files. We are good to go!'
                }
              }
            ]
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: cfg
        } as any;
      }

      throw new Error(`Unexpected mock API call count: ${callCount}`);
    };
    return config;
  });

  resetHistory();
  const spinner = ora('Testing...');
  const result = await askLuminineAI('List the ts files', spinner);
  spinner.stop();

  console.log(`\n📝 Test Results:`);
  console.log(`- Final Response: "${result}"`);
  console.log(`- API Call Count: ${callCount}`);
  console.log(`- Received Tool Result: ${receivedToolResult ? '✅ YES' : '❌ NO'}`);

  // Assertions
  assert.strictEqual(callCount, 2, 'Should have made exactly 2 API calls (1 for prompt, 1 for tool response)');
  assert.strictEqual(receivedToolResult, true, 'Should have successfully executed the tool and passed the result to the model');
  assert.ok(result.includes('Perfect, I see the TS files'), 'Should return the final simulated assistant response');

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! Tool calling for askLuminineAI is verified.');
}

runTest().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
