# 数据流优化方案：以数据库为准的统一调整

## 优化原则

**核心原则**: 以数据库字段结构为准，统一调整Python角色识别服务、LLM台本生成和前端展示，确保数据流的一致性。

## 1. 数据库字段标准分析

### 1.1 核心表结构标准

#### CharacterProfile表 (角色配置)
```prisma
canonicalName     String    // 标准角色名 (主键字段)
characteristics   Json      // 角色特征: description, personality, importance, relationships
voicePreferences  Json      // 声音偏好: dialogueStyle
emotionProfile    Json      // 情感配置: baseEmotion, emotionVariability, commonEmotions
genderHint        String    // 性别提示: male/female/unknown
ageHint           Int?      // 年龄提示
emotionBaseline   String    // 情感基线: neutral
isActive          Boolean   // 是否激活
```

#### CharacterAlias表 (角色别名)
```prisma
alias          String    // 别名内容
confidence     Decimal   // 置信度 0.00-1.00
sourceSentence String?   // 来源句子
```

#### ScriptSentence表 (台词)
```prisma
characterId    String?   // 角色ID (null表示旁白)
rawSpeaker     String?   // 原始说话人
text           String    // 台词内容
orderInSegment Int       // 段内顺序
tone           String?   // 语气/情感
strength       Int?      // 强度 0-100
pauseAfter     Decimal?  // 后停顿时间 (秒)
ttsParameters  Json?     // TTS参数
```

## 2. 服务端结构调整方案

### 2.1 Python角色识别服务调整

#### 修改Character模型 (character-recognition/src/models/character.py)
```python
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class Character(BaseModel):
    """人物实体 - 对齐数据库字段"""
    canonical_name: str = Field(..., description="标准角色名")
    aliases: List[str] = Field(default_factory=list, description="别名列表")
    characteristics: Dict[str, Any] = Field(default_factory=dict, description="角色特征")
    voice_preferences: Dict[str, Any] = Field(default_factory=dict, description="声音偏好")
    emotion_profile: Dict[str, Any] = Field(default_factory=dict, description="情感配置")
    gender_hint: str = Field(default="unknown", description="性别提示")
    age_hint: Optional[int] = Field(default=None, description="年龄提示")
    emotion_baseline: str = Field(default="neutral", description="情感基线")
    is_active: bool = Field(default=True, description="是否激活")
    
    # 统计信息存储在characteristics中
    mentions: int = Field(default=0, description="被提及次数")
    quotes: int = Field(default=0, description="台词数量")
    first_appearance_idx: int = Field(default=-1, description="首次出现位置")
    roles: List[str] = Field(default_factory=list, description="角色身份")

class CharacterAlias(BaseModel):
    """角色别名 - 对齐数据库字段"""
    alias: str = Field(..., description="别名内容")
    confidence: float = Field(default=0.8, description="置信度")
    source_sentence: Optional[str] = Field(default=None, description="来源句子")

class RecognitionResponse(BaseModel):
    """识别响应 - 对齐数据库结构"""
    characters: List[Character] = Field(..., description="识别到的人物列表")
    alias_map: Dict[str, str] = Field(default_factory=dict, description="别名映射表")
    relations: List[Dict[str, Any]] = Field(default_factory=list, description="人物关系")
    statistics: Dict[str, Any] = Field(..., description="统计信息")
```

#### 修改识别逻辑 (character-recognition/src/core/ner.py)
```python
def convert_to_database_format(self, characters: List[Character]) -> List[Dict[str, Any]]:
    """转换为数据库格式"""
    result = []
    for char in characters:
        # 构建characteristics
        characteristics = {
            "description": f"提及{char.mentions}次，对话{char.quotes}次",
            "personality": char.personality if hasattr(char, 'personality') else [],
            "importance": self._determine_importance(char.quotes),
            "relationships": {},
            "mentions": char.mentions,
            "quotes": char.quotes,
            "firstAppearance": char.first_appearance_idx,
            "roles": char.roles
        }
        
        # 构建voice_preferences
        voice_preferences = {
            "dialogueStyle": "自然"  # 默认值
        }
        
        # 构建emotion_profile
        emotion_profile = {
            "baseEmotion": char.emotion_baseline,
            "emotionVariability": "medium",
            "commonEmotions": []
        }
        
        result.append({
            "canonical_name": char.name,  # name -> canonical_name
            "aliases": [{"alias": alias, "confidence": 0.8} for alias in char.aliases],
            "characteristics": characteristics,
            "voice_preferences": voice_preferences,
            "emotion_profile": emotion_profile,
            "gender_hint": char.gender or "unknown",
            "age_hint": None,
            "emotion_baseline": char.emotion_baseline or "neutral",
            "is_active": True
        })
    
    return result
```

### 2.2 LLM台本生成服务调整

#### 修改ScriptGenerator (apps/web/src/lib/script-generator.ts)
```typescript
export interface DialogueLine {
  id: string;
  characterId?: string | null;  // 对齐数据库字段
  rawSpeaker?: string;          // 对齐数据库字段
  text: string;
  orderInSegment: number;       // 对齐数据库字段
  tone?: string;               // 对齐数据库字段
  strength?: number;            // 对齐数据库字段 (0-100)
  pauseAfter?: number;          // 对齐数据库字段 (秒)
  ttsParameters?: Record<string, any>; // 对齐数据库字段
  segmentId: string;
  isNarration?: boolean;        // 内部使用，不存数据库
}

export interface GeneratedScript {
  dialogueLines: DialogueLine[];
  summary: {
    totalLines: number;
    dialogueCount: number;
    narrationCount: number;
    characterDistribution: Record<string, number>;
    emotionDistribution: Record<string, number>;
  };
  segments: Array<{
    segmentId: string;
    lineCount: number;
    characters: string[];
  }>;
}

// 修改LLM提示词，要求返回数据库字段格式
private generateLLMPrompt(characterInfo: any[]): string {
  return `请返回JSON格式的台词数组，每个台词对象包含以下字段（严格按照数据库字段命名）：

[
  {
    "characterId": "角色ID或null（旁白）",
    "rawSpeaker": "原始说话人名称",
    "text": "台词内容",
    "orderInSegment": 0,
    "tone": "语气/情感",
    "strength": 75,
    "pauseAfter": 1.5,
    "ttsParameters": {
      "pitch": 1.0,
      "rate": 1.0,
      "volume": 1.0
    }
  }
]

字段说明：
- characterId: 角色的canonicalName，旁白使用null
- rawSpeaker: 原始识别的说话人名称
- text: 台词内容
- orderInSegment: 在段落中的顺序
- tone: 情感/语气（平静、激动、悲伤等）
- strength: 强度（0-100）
- pauseAfter: 后停顿时间（秒）
- ttsParameters: TTS参数对象

已知角色信息：
${characterInfo.map(char => 
  `- ${char.canonicalName} (性别: ${char.genderHint}, 年龄: ${char.ageHint || '未知'})`
).join('\n')}`;
}

// 修改数据保存逻辑，直接使用数据库字段
private async saveSegmentScriptToDatabase(
  bookId: string,
  segmentId: string,
  dialogueLines: DialogueLine[]
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 删除现有台词
    await tx.scriptSentence.deleteMany({
      where: { bookId, segmentId }
    });

    // 保存新台词
    for (const line of dialogueLines) {
      // 查找角色ID
      const character = line.characterId ? 
        await tx.characterProfile.findFirst({
          where: { 
            bookId, 
            canonicalName: line.characterId,
            isActive: true 
          }
        }) : null;

      await tx.scriptSentence.create({
        data: {
          bookId,
          segmentId,
          characterId: character?.id || null,
          rawSpeaker: line.rawSpeaker,
          text: line.text,
          orderInSegment: line.orderInSegment,
          tone: line.tone,
          strength: line.strength,
          pauseAfter: line.pauseAfter,
          ttsParameters: line.ttsParameters
        }
      });
    }
  });
}
```

## 3. 前端结构调整方案

### 3.1 统一前端类型定义

#### 修改类型定义 (apps/web/src/lib/types.ts)
```typescript
// 以数据库字段为准的类型定义
export interface CharacterProfile {
  id: string;
  bookId: string;
  canonicalName: string;        // 数据库字段名
  characteristics: {
    description?: string;
    personality?: string[];
    importance?: string;
    relationships?: Record<string, string>;
    mentions?: number;
    quotes?: number;
    firstAppearance?: number;
    roles?: string[];
  };
  voicePreferences: {
    dialogueStyle?: string;
  };
  emotionProfile: {
    baseEmotion?: string;
    emotionVariability?: string;
    commonEmotions?: string[];
  };
  genderHint: string;           // 数据库字段名
  ageHint?: number;
  emotionBaseline: string;
  isActive: boolean;
  aliases: CharacterAlias[];
  createdAt: string;
  updatedAt: string;
}

export interface CharacterAlias {
  id: string;
  characterId: string;
  alias: string;               // 数据库字段名
  confidence: number;          // Decimal转换
  sourceSentence?: string;
  createdAt: string;
}

export interface ScriptSentence {
  id: string;
  bookId: string;
  segmentId: string;
  characterId?: string | null;  // 数据库字段名
  rawSpeaker?: string;          // 数据库字段名
  text: string;
  orderInSegment: number;       // 数据库字段名
  tone?: string;               // 数据库字段名
  strength?: number;            // 数据库字段名
  pauseAfter?: number;          // Decimal转换
  ttsParameters?: {
    pitch?: number;
    rate?: number;
    volume?: number;
    style?: string;
  };
  createdAt: string;
  
  // 关联数据
  character?: CharacterProfile | null;
  segment?: {
    id: string;
    content: string;
    orderIndex: number;
  };
}
```

### 3.2 修改前端组件

#### 修改ScriptSentenceCard组件 (apps/web/src/app/books/[id]/script/components/ScriptSentenceCard.tsx)
```typescript
import { ScriptSentence } from "@/lib/types"; // 使用统一类型

interface ScriptSentenceCardProps {
  sentence: ScriptSentence;
  index: number;
  onEdit: (sentence: ScriptSentence) => void;
  onDelete: (sentenceId: string) => void;
}

export function ScriptSentenceCard({
  sentence,
  index,
  onEdit,
  onDelete,
}: ScriptSentenceCardProps) {
  return (
    <div className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-sm font-medium text-gray-500">
            #{index + 1}
          </span>
          {sentence.character ? (
            <Badge variant="outline">
              <User className="w-3 h-3 mr-1" />
              {sentence.character.canonicalName} {/* 使用canonicalName */}
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="bg-gray-100 text-gray-600 border-gray-300"
            >
              <Volume2 className="w-3 h-3 mr-1" />
              旁白
            </Badge>
          )}
          {sentence.tone && (
            <Badge
              variant="secondary"
              className="bg-purple-100 text-purple-700 border-purple-300"
            >
              {sentence.tone}
            </Badge>
          )}
          {sentence.strength && (
            <Badge variant="outline" className="text-xs">
              强度: {sentence.strength}
            </Badge>
          )}
          <span className="text-xs text-gray-500">
            段落 {sentence.segment?.orderIndex ? sentence.segment.orderIndex + 1 : sentence.orderInSegment + 1}
          </span>
        </div>
        <p className="text-gray-900">{sentence.text}</p>
        {sentence.rawSpeaker && sentence.rawSpeaker !== sentence.character?.canonicalName && (
          <p className="text-xs text-gray-500 mt-1">
            原始说话人: {sentence.rawSpeaker}
          </p>
        )}
      </div>
      <div className="flex space-x-1 ml-4 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(sentence)}
          title="编辑台词"
        >
          <Edit className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(sentence.id)}
          className="text-red-600 hover:text-red-800 hover:bg-red-50"
          title="删除台词"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
```

#### 修改CharacterAssignment组件 (apps/web/src/app/books/[id]/script/components/CharacterAssignment.tsx)
```typescript
import { CharacterProfile } from "@/lib/types"; // 使用统一类型

interface CharacterAssignmentProps {
  characters: CharacterProfile[];
  onCharacterSelect: (characterId: string) => void;
  selectedCharacterId?: string;
}

export function CharacterAssignment({ 
  characters, 
  onCharacterSelect, 
  selectedCharacterId 
}: CharacterAssignmentProps) {
  return (
    <div className="space-y-4">
      {characters.map((character) => (
        <div
          key={character.id}
          className={`p-4 border rounded-lg cursor-pointer transition-colors ${
            selectedCharacterId === character.id
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 hover:border-gray-300"
          }`}
          onClick={() => onCharacterSelect(character.id)}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-lg">
                {character.canonicalName} {/* 使用canonicalName */}
              </h3>
              <p className="text-sm text-gray-600">
                {character.characteristics.description}
              </p>
              <div className="flex items-center space-x-2 mt-2">
                <Badge variant="outline">
                  {character.genderHint}
                </Badge>
                {character.ageHint && (
                  <Badge variant="outline">
                    {character.ageHint}岁
                  </Badge>
                )}
                <Badge variant="secondary">
                  {character.characteristics.importance}
                </Badge>
              </div>
              {character.aliases.length > 0 && (
                <div className="mt-2">
                  <span className="text-xs text-gray-500">别名:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {character.aliases.map((alias) => (
                      <Badge key={alias.id} variant="secondary" className="text-xs">
                        {alias.alias}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

## 4. 数据库优化建议

### 4.1 添加缺失字段

```sql
-- 为CharacterProfile添加统计字段（可选，也可以继续在JSON中存储）
ALTER TABLE character_profiles 
ADD COLUMN IF NOT EXISTS mentions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS quotes INTEGER DEFAULT 0;

-- 为ScriptSentence添加索引优化
CREATE INDEX IF NOT EXISTS idx_script_sentences_book_segment_order 
ON script_sentences(bookId, segmentId, orderInSegment);

-- 为CharacterAlias添加复合索引
CREATE INDEX IF NOT EXISTS idx_character_aliases_character_confidence 
ON character_aliases(characterId, confidence DESC);
```

### 4.2 优化字段类型

```prisma
model CharacterProfile {
  // ... 现有字段
  mentions       Int?      @default(0)  // 从JSON移到直接字段
  quotes         Int?      @default(0)  // 从JSON移到直接字段
}

model ScriptSentence {
  // ... 现有字段
  strength       Int?      @default(75)  // 默认值
  pauseAfter     Decimal?  @default(1.5) @db.Decimal(3, 1) // 默认值
}
```

## 5. API接口统一

### 5.1 角色识别API调整

```typescript
// apps/web/src/app/api/books/[id]/characters/recognize/route.ts
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: bookId } = await params;
  
  // 调用Python服务
  const recognitionResult = await characterRecognitionClient.recognize({
    text: fullText,
    options: {
      enable_coreference: true,
      enable_dialogue: true,
      enable_relations: true
    }
  });

  // 直接保存到数据库（字段已对齐）
  await prisma.$transaction(async (tx) => {
    for (const char of recognitionResult.characters) {
      // 创建角色配置
      const profile = await tx.characterProfile.create({
        data: {
          bookId,
          canonicalName: char.canonical_name,
          characteristics: char.characteristics,
          voicePreferences: char.voice_preferences,
          emotionProfile: char.emotion_profile,
          genderHint: char.gender_hint,
          ageHint: char.age_hint,
          emotionBaseline: char.emotion_baseline,
          isActive: char.is_active,
          mentions: char.mentions,
          quotes: char.quotes
        }
      });

      // 创建别名
      if (char.aliases && char.aliases.length > 0) {
        await tx.characterAlias.createMany({
          data: char.aliases.map(alias => ({
            characterId: profile.id,
            alias: alias.alias,
            confidence: alias.confidence,
            sourceSentence: alias.source_sentence
          }))
        });
      }
    }
  });

  return NextResponse.json({
    success: true,
    data: {
      message: `成功识别并创建${recognitionResult.characters.length}个角色`,
      characters: recognitionResult.characters.length
    }
  });
});
```

### 5.2 台本生成API调整

```typescript
// apps/web/src/app/api/books/[id]/script/generate/route.ts
// 现有代码基本符合，只需要确保LLM返回格式正确
// 修改LLM提示词部分已在上面说明
```

## 6. 实施计划

### 阶段1: 数据库结构优化 (0.5天)
1. 执行数据库迁移脚本
2. 更新Prisma schema
3. 重新生成类型定义

### 阶段2: Python服务调整 (1天)
1. 修改Character模型字段名
2. 更新识别逻辑返回格式
3. 测试服务集成

### 阶段3: LLM台本生成调整 (1天)
1. 修改LLM提示词格式
2. 更新数据保存逻辑
3. 测试台本生成

### 阶段4: 前端组件调整 (1天)
1. 更新类型定义
2. 修改所有相关组件
3. 测试界面显示

### 阶段5: 集成测试 (0.5天)
1. 端到端流程测试
2. 数据一致性验证
3. 性能测试

## 7. 预期效果

### 7.1 数据一致性
- 所有服务使用相同的字段命名规范
- 消除数据转换错误
- 简化维护工作

### 7.2 开发效率
- 前后端类型定义统一
- 减少字段映射逻辑
- 提高代码可读性

### 7.3 系统稳定性
- 减少因字段不匹配导致的bug
- 提高数据传输可靠性
- 简化调试过程

## 8. 风险控制

### 8.1 数据迁移风险
- **风险**: 现有数据可能不兼容新结构
- **缓解**: 提供数据迁移脚本，完整备份

### 8.2 服务兼容性
- **风险**: Python服务修改可能影响现有功能
- **缓解**: 保持API接口不变，只调整内部数据结构

### 8.3 前端显示问题
- **风险**: 字段名变更可能导致显示异常
- **缓解**: 充分的单元测试和集成测试

## 9. 总结

通过以数据库字段为准的统一调整方案，我们将：

1. **建立统一的数据标准** - 所有服务遵循相同的字段命名和结构
2. **简化数据流** - 消除复杂的数据转换逻辑
3. **提高开发效率** - 统一的类型定义和接口规范
4. **增强系统稳定性** - 减少因数据不匹配导致的问题

这个方案相比之前的转换层方案更加直接和高效，能够从根本上解决数据结构不一致的问题。
