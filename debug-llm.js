#!/usr/bin/env node

/**
 * LLM调试脚本
 * 用于精确复制LLM服务的调用逻辑
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

async function makeFetch(url, options) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : require('http');

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = httpModule.request(requestOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          json: async () => {
            try {
              return JSON.parse(body);
            } catch (e) {
              throw new Error(`Invalid JSON: ${body}`);
            }
          },
          text: async () => body
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function testExactLLMLogic() {
  console.log('🔍 精确复制LLM服务逻辑进行测试\n');

  const provider = {
    name: process.env.LLM_PROVIDER || 'openai',
    apiKey: process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || '',
    baseURL: process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL,
    model: process.env.LLM_MODEL || 'gpt-3.5-turbo'
  };

  console.log('📋 Provider配置:');
  console.log(`name: ${provider.name}`);
  console.log(`apiKey: ${provider.apiKey.slice(0, 8)}****`);
  console.log(`baseURL: ${provider.baseURL}`);
  console.log(`model: ${provider.model}`);
  console.log('');

  if (!provider.apiKey) {
    console.log('❌ API Key未设置');
    return;
  }

  // 复制LLM服务的URL构建逻辑
  let baseURL = provider.baseURL || 'https://api.openai.com/v1';

  console.log(`📍 初始baseURL: ${baseURL}`);

  // 如果baseURL已经是完整的API端点，直接使用
  if (baseURL.endsWith('/chat/completions')) {
    console.log('✅ baseURL已经包含/chat/completions，无需修改');
  } else if (baseURL.endsWith('/v1')) {
    baseURL = `${baseURL}/chat/completions`;
    console.log(`🔗 baseURL以/v1结尾，添加chat/completions: ${baseURL}`);
  } else {
    baseURL = `${baseURL}/v1/chat/completions`;
    console.log(`🔗 baseURL没有版本信息，添加/v1/chat/completions: ${baseURL}`);
  }

  console.log('');

  // 构建请求体
  const requestBody = {
    model: provider.model,
    messages: [
      { role: 'user', content: '请回答"测试成功"' }
    ],
    temperature: 0.3,
    max_tokens: 1000
  };

  // DeepSeek API特殊处理
  if (provider.name === 'custom' && baseURL.includes('deepseek.com')) {
    requestBody.stream = false;
    console.log('🔧 为DeepSeek API添加stream=false参数');
  }

  console.log('📤 请求体:');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('');

  console.log('🌐 发送请求...');
  console.log(`URL: ${baseURL}`);

  try {
    const response = await makeFetch(baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`📊 响应状态: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log('❌ 请求失败');
      console.log('错误详情:', JSON.stringify(errorData, null, 2));
      return;
    }

    const data = await response.json();
    console.log('✅ 请求成功!');

    if (data.choices && data.choices[0]) {
      const reply = data.choices[0].message?.content || '无回复内容';
      console.log(`🤖 AI回复: "${reply.trim()}"`);
    } else {
      console.log('⚠️  响应格式异常:', JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.log('💥 请求异常:', error.message);
    console.log('错误堆栈:', error.stack);
  }
}

testExactLLMLogic().catch(console.error);