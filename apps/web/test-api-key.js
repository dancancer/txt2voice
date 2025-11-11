#!/usr/bin/env node

/**
 * API Key验证脚本
 * 用于测试DeepSeek API Key是否有效
 */

const https = require('https');
const http = require('http');

// 读取环境变量
const fs = require('fs');
const path = require('path');

function loadEnv() {
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
}

function makeHttpsRequest(url, options, data) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    const req = protocol.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: jsonBody
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function testDeepSeekAPI() {
  loadEnv();

  console.log('🔍 DeepSeek API Key验证工具\n');

  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  const baseURL = process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1';
  const model = process.env.LLM_MODEL || 'deepseek-chat';

  if (!apiKey) {
    console.log('❌ 错误: 未找到API Key');
    console.log('请设置LLM_API_KEY或OPENAI_API_KEY环境变量');
    return;
  }

  console.log('📋 当前配置:');
  console.log(`API Key: ${apiKey.slice(0, 8)}****`);
  console.log(`Base URL: ${baseURL}`);
  console.log(`Model: ${model}`);
  console.log('');

  // 测试1: 检查API Key格式
  console.log('🧪 测试1: 检查API Key格式');
  if (apiKey.startsWith('sk-')) {
    console.log('✅ API Key格式正确 (以sk-开头)');
  } else {
    console.log('⚠️  API Key格式可能不正确 (DeepSeek通常以sk-开头)');
  }
  console.log('');

  // 测试2: 检查账户余额 (DeepSeek特有端点)
  console.log('🧪 测试2: 检查账户状态');
  try {
    const balanceURL = 'https://api.deepseek.com/user/balance';
    const response = await makeHttpsRequest(balanceURL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.statusCode === 200) {
      console.log('✅ 账户状态正常');
      if (response.body.balance_infos) {
        const totalBalance = response.body.balance_infos.reduce((sum, info) => sum + info.total_balance, 0);
        console.log(`💰 账户余额: ${totalBalance} USD`);
        if (totalBalance > 0) {
          console.log('✅ 余额充足，可以使用API');
        } else {
          console.log('⚠️  余额不足，请充值后重试');
        }
      }
    } else {
      console.log(`❌ 账户状态检查失败 (${response.statusCode})`);
      if (response.body.error) {
        console.log(`错误信息: ${response.body.error.message}`);
      }
    }
  } catch (error) {
    console.log(`❌ 无法检查账户状态: ${error.message}`);
  }
  console.log('');

  // 测试3: 模型列表检查
  console.log('🧪 测试3: 检查可用模型');
  try {
    const modelsURL = 'https://api.deepseek.com/models';
    const response = await makeHttpsRequest(modelsURL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.statusCode === 200) {
      console.log('✅ 成功获取模型列表');
      if (response.body.data && Array.isArray(response.body.data)) {
        const availableModels = response.body.data.map(m => m.id);
        console.log('🤖 可用模型:', availableModels.join(', '));

        if (availableModels.includes(model)) {
          console.log(`✅ 模型 ${model} 可用`);
        } else {
          console.log(`⚠️  模型 ${model} 不可用，可用模型见上`);
        }
      }
    } else {
      console.log(`❌ 模型列表获取失败 (${response.statusCode})`);
      if (response.body.error) {
        console.log(`错误信息: ${response.body.error.message}`);
      }
    }
  } catch (error) {
    console.log(`❌ 无法获取模型列表: ${error.message}`);
  }
  console.log('');

  // 测试4: 简单的聊天请求测试
  console.log('🧪 测试4: 简单聊天请求测试');
  try {
    const chatURL = `${baseURL}/chat/completions`;
    const requestData = JSON.stringify({
      model: model,
      messages: [
        {
          role: 'user',
          content: '请回答"测试成功"'
        }
      ],
      max_tokens: 10,
      temperature: 0.1
    });

    const response = await makeHttpsRequest(chatURL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      }
    }, requestData);

    if (response.statusCode === 200) {
      console.log('✅ 聊天请求成功');
      if (response.body.choices && response.body.choices[0]) {
        const reply = response.body.choices[0].message?.content || '无回复内容';
        console.log(`🤖 AI回复: "${reply.trim()}"`);
      }
    } else {
      console.log(`❌ 聊天请求失败 (${response.statusCode})`);
      if (response.body.error) {
        console.log(`错误信息: ${response.body.error.message}`);
        console.log(`错误类型: ${response.body.error.type || '未知'}`);
        console.log(`错误代码: ${response.body.error.code || '未知'}`);
      }
    }
  } catch (error) {
    console.log(`❌ 聊天请求异常: ${error.message}`);
  }
  console.log('');

  // 提供解决方案建议
  console.log('🔧 故障排除建议:');
  console.log('1. 确认API Key是否正确复制，没有多余的空格或换行');
  console.log('2. 检查API Key是否已激活');
  console.log('3. 确认DeepSeek账户状态正常');
  console.log('4. 验证网络连接是否正常');
  console.log('5. 如果使用代理，确保代理设置正确');
  console.log('');
  console.log('📞 DeepSeek官方支持: https://platform.deepseek.com/');
}

// 运行测试
testDeepSeekAPI().catch(error => {
  console.error('💥 测试过程中发生未预期错误:', error);
  process.exit(1);
});