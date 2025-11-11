#!/usr/bin/env node

/**
 * DeepSeek API端点测试
 * 测试不同的API端点格式
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// 加载环境变量
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...values] = trimmed.split('=');
      if (key && values.length > 0) {
        process.env[key] = values.join('=').replace(/^["']|["']$/g, '');
      }
    }
  });
}

const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
const model = process.env.LLM_MODEL || 'deepseek-chat';

console.log('🧪 测试DeepSeek API端点\n');
console.log(`API Key: ${apiKey.slice(0, 8)}****`);
console.log(`Model: ${model}\n`);

async function testEndpoint(endpoint, description) {
  console.log(`🔍 测试: ${description}`);
  console.log(`端点: ${endpoint}`);

  return new Promise((resolve) => {
    const requestData = JSON.stringify({
      model: model,
      messages: [
        {
          role: 'user',
          content: '回答"成功"'
        }
      ],
      max_tokens: 10,
      temperature: 0.1,
      stream: false
    });

    const options = {
      hostname: 'api.deepseek.com',
      port: 443,
      path: endpoint,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const jsonResponse = body ? JSON.parse(body) : {};
          console.log(`状态码: ${res.statusCode}`);

          if (res.statusCode === 200) {
            console.log('✅ 成功!');
            if (jsonResponse.choices && jsonResponse.choices[0]) {
              const reply = jsonResponse.choices[0].message?.content || '无回复';
              console.log(`🤖 AI回复: "${reply.trim()}"`);
            }
          } else {
            console.log('❌ 失败');
            if (jsonResponse.error) {
              console.log(`错误: ${jsonResponse.error.message}`);
            }
          }
        } catch (e) {
          console.log(`❌ 解析响应失败: ${e.message}`);
        }
        console.log('---\n');
        resolve(res.statusCode === 200);
      });
    });

    req.on('error', (error) => {
      console.log(`❌ 请求错误: ${error.message}`);
      console.log('---\n');
      resolve(false);
    });

    req.write(requestData);
    req.end();
  });
}

async function runTests() {
  // 测试不同的端点格式
  const endpoints = [
    { path: '/v1/chat/completions', desc: '标准OpenAI兼容端点 (/v1/chat/completions)' },
    { path: '/chat/completions', desc: '直接聊天端点 (/chat/completions)' },
    { path: '/v1/chat/completions/', desc: '带尾部斜杠的端点 (/v1/chat/completions/)' }
  ];

  for (const endpoint of endpoints) {
    const success = await testEndpoint(endpoint.path, endpoint.desc);
    if (success) {
      console.log(`🎉 找到正确端点: ${endpoint.path}`);

      // 更新.env文件
      console.log('📝 正在更新.env文件...');
      let envContent = fs.readFileSync('.env', 'utf8');
      const baseURL = `https://api.deepseek.com${endpoint.path.replace('/chat/completions', '')}`;

      // 替换LLM_BASE_URL行
      envContent = envContent.replace(
        /^LLM_BASE_URL=.*$/m,
        `LLM_BASE_URL="${baseURL}"`
      );

      fs.writeFileSync('.env', envContent);
      console.log(`✅ 已更新LLM_BASE_URL为: ${baseURL}`);
      break;
    }
  }

  console.log('🏁 测试完成');
}

runTests().catch(console.error);