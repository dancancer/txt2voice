#!/bin/bash
# API 测试脚本

API_URL="${1:-http://localhost:8001}"

echo "======================================"
echo "测试人物识别 API"
echo "API URL: $API_URL"
echo "======================================"
echo ""

# 测试健康检查
echo "1. 测试健康检查..."
curl -s "$API_URL/health" | python3 -m json.tool
echo ""
echo ""

# 测试统计信息
echo "2. 测试统计信息..."
curl -s "$API_URL/api/stats" | python3 -m json.tool
echo ""
echo ""

# 测试人物识别
echo "3. 测试人物识别..."
curl -s -X POST "$API_URL/api/recognize" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "雅芙是老板的女儿，人称大小姐。王强走了进来，看到雅芙坐在沙发上。\"雅芙小姐，好久不见。\"他笑着说。\"王强，你来找我有什么事？\"她问道。",
    "options": {
      "enable_coreference": true,
      "enable_dialogue": true,
      "enable_relations": true,
      "similarity_threshold": 0.8
    }
  }' | python3 -m json.tool
echo ""

echo "======================================"
echo "测试完成！"
echo "======================================"
