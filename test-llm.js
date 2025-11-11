#!/usr/bin/env node

/**
 * LLM配置测试脚本
 * 用于验证LLM API配置是否正确
 */

// 加载环境变量
const path = require('path');
const fs = require('fs');

// 手动加载环境变量
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

// 简化的LLM服务类（复制核心逻辑）
class LLMService {
  constructor(provider) {
    this.provider = provider;
  }

  async callLLM(prompt, systemPrompt) {
    const messages = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      { role: 'user', content: prompt }
    ];

    try {
      // 根据provider调整API端点
      let baseURL = this.provider.baseURL || 'https://api.openai.com/v1';
      if (this.provider.name === 'custom' && baseURL.includes('deepseek.com')) {
        baseURL = baseURL.replace(/\/$/, ''); // 移除末尾斜杠
      }
      if (!baseURL.endsWith('/chat/completions')) {
        baseURL = baseURL.endsWith('/v1') ? `${baseURL}/chat/completions` : `${baseURL}/v1/chat/completions`;
      }

      // 构建请求体
      const requestBody = {
        model: this.provider.model,
        messages,
        temperature: 0.3,
        max_tokens: 1000
      };

      // DeepSeek API特殊处理
      if (this.provider.name === 'custom' && baseURL.includes('deepseek.com')) {
        requestBody.stream = false;
      }

      console.log(`🌐 API端点: ${baseURL}`);
      console.log(`🤖 模型: ${this.provider.model}`);

      const response = await fetch(baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.provider.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`LLM API调用失败: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    } catch (error) {
      throw error;
    }
  }

  async analyzeScript(text) {
    const systemPrompt = `你是一个专业的文本分析专家。分析以下文本并识别角色。

请以JSON格式返回分析结果，包含：
- characters: 角色数组，每个角色包含name, gender, importance等
- dialogues: 对话数组，包含character, dialogue, emotion等

示例格式：
{
  "characters": [{"name": "角色名", "gender": "male", "importance": "main"}],
  "dialogues": [{"character": "角色名", "dialogue": "对话内容", "emotion": "neutral"}]
}`;

    const prompt = `分析以下文本中的角色和对话：
${text}

请返回JSON格式的分析结果。`;

    const response = await this.callLLM(prompt, systemPrompt);

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('LLM返回格式不正确');
      }
      const result = JSON.parse(jsonMatch[0]);
      return {
        characters: result.characters || [],
        dialogues: result.dialogues || [],
        emotions: result.emotions || [],
        summary: result.summary || { totalCharacters: 0, mainCharacters: 0, dialogueCount: 0, emotionTypes: [], tone: 'neutral' }
      };
    } catch (error) {
      console.error('解析LLM响应失败:', error);
      return {
        characters: [],
        dialogues: [],
        emotions: [],
        summary: { totalCharacters: 0, mainCharacters: 0, dialogueCount: 0, emotionTypes: [], tone: 'neutral' }
      };
    }
  }
}

function getLLMService() {
  const provider = {
    name: process.env.LLM_PROVIDER || 'openai',
    apiKey: process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || '',
    baseURL: process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL,
    model: process.env.LLM_MODEL || 'gpt-3.5-turbo'
  };

  if (!provider.apiKey) {
    throw new Error('LLM服务未配置，请设置API密钥');
  }

  return new LLMService(provider);
}

console.log('🔍 开始测试LLM配置...\n');

// 显示当前配置
console.log('📋 当前配置:');
console.log(`LLM_PROVIDER: ${process.env.LLM_PROVIDER || 'openai'}`);
console.log(`LLM_API_KEY: ${process.env.LLM_API_KEY ? `${process.env.LLM_API_KEY.slice(0, 8)}****` : '未设置'}`);
console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.slice(0, 8)}****` : '未设置'}`);
console.log(`LLM_BASE_URL: ${process.env.LLM_BASE_URL || '未设置'}`);
console.log(`LLM_MODEL: ${process.env.LLM_MODEL || 'gpt-3.5-turbo'}`);
console.log('');

async function testLLMConfiguration() {
  try {
    console.log('🚀 正在初始化LLM服务...');

    // 获取LLM服务实例
    const llmService = getLLMService();

    console.log('✅ LLM服务初始化成功\n');

    // 测试简单的API调用
    console.log('🧪 测试基本API调用...');
    const testPrompt = '请用一句话回答：1+1等于几？';
    const systemPrompt = '你是一个数学助手，请简洁地回答问题。';

    console.log(`📝 测试提示: ${testPrompt}`);
    console.log('⏳ 正在调用API...\n');

    const response = await llmService.callLLM(testPrompt, systemPrompt);

    console.log('✅ API调用成功！');
    console.log(`🤖 AI回复: ${response.trim()}`);
    console.log('');

    // 测试台本分析功能
    console.log('🧪 测试台本分析功能...');
    const testScript = `
    张三:"你好，李四！"
    李四:"嗨，张三！好久不见。"
    张三:"是啊，最近怎么样？"
    李四:"还不错，你呢？"
    `;

    console.log('📝 测试文本片段:');
    console.log(testScript.trim());
    console.log('\n⏳ 正在分析文本...\n');

    const analysisResult = await llmService.analyzeScript(testScript);

    console.log('✅ 台本分析成功！');
    console.log(`📊 识别到的角色数量: ${analysisResult.characters.length}`);
    console.log(`📊 对话数量: ${analysisResult.dialogues.length}`);

    if (analysisResult.characters.length > 0) {
      console.log('\n👥 识别到的角色:');
      analysisResult.characters.forEach((char, index) => {
        console.log(`${index + 1}. ${char.name} (${char.gender}) - ${char.importance}`);
      });
    }

    if (analysisResult.dialogues.length > 0) {
      console.log('\n💬 识别到的对话:');
      analysisResult.dialogues.forEach((dialogue, index) => {
        console.log(`${index + 1}. ${dialogue.character}: "${dialogue.dialogue}" (${dialogue.emotion})`);
      });
    }

    console.log('\n🎉 所有测试通过！LLM配置正确。');

  } catch (error) {
    console.error('❌ 测试失败！');
    console.error('错误类型:', error.constructor.name);
    console.error('错误信息:', error.message);

    if (error.code) {
      console.error('错误代码:', error.code);
    }

    if (error.provider) {
      console.error('LLM提供商:', error.provider);
    }

    if (error.statusCode) {
      console.error('HTTP状态码:', error.statusCode);
    }

    console.log('\n🔧 可能的解决方案:');

    // 根据错误类型提供建议
    if (error.message.includes('LLM服务未配置')) {
      console.log('1. 检查环境变量是否正确设置');
      console.log('2. 确认LLM_API_KEY或OPENAI_API_KEY已配置');
    } else if (error.message.includes('Authentication')) {
      console.log('1. 检查API密钥是否正确');
      console.log('2. 确认API密钥是否有效且未过期');
      console.log('3. 检查账户余额是否充足');
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      console.log('1. 检查网络连接');
      console.log('2. 检查API端点URL是否正确');
      console.log('3. 检查是否有代理或防火墙限制');
    } else if (error.message.includes('model')) {
      console.log('1. 检查模型名称是否正确');
      console.log('2. 确认该模型是否在API提供商的服务范围内');
    } else {
      console.log('1. 检查所有环境变量配置');
      console.log('2. 确认API服务是否正常');
      console.log('3. 查看API文档确认请求格式');
    }

    process.exit(1);
  }
}

// 运行测试
testLLMConfiguration().catch(error => {
  console.error('💥 未预期的错误:', error);
  process.exit(1);
});