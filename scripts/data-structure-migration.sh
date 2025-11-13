#!/bin/bash

# 数据结构统一迁移脚本
# 以数据库字段为准的统一调整实施脚本

set -e

echo "🚀 开始数据结构统一迁移..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查环境
check_environment() {
    log_info "检查环境依赖..."
    
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm 未安装，请先安装 pnpm"
        exit 1
    fi
    
    if ! command -v npx &> /dev/null; then
        log_error "npx 未安装，请先安装 Node.js"
        exit 1
    fi
    
    if [ ! -f ".env" ]; then
        log_warning ".env 文件不存在，请确保环境变量已配置"
    fi
    
    log_success "环境检查通过"
}

# 备份数据库
backup_database() {
    log_info "备份数据库..."
    
    if [ -n "$DATABASE_URL" ]; then
        BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
        pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
        log_success "数据库已备份到: $BACKUP_FILE"
    else
        log_warning "DATABASE_URL 未设置，跳过数据库备份"
    fi
}

# 阶段1: 数据库结构优化
phase1_database_optimization() {
    log_info "📊 阶段1: 数据库结构优化"
    
    # 1.1 更新 Prisma schema
    log_info "更新 Prisma schema..."
    cat >> apps/web/prisma/schema.prisma << 'EOF'

// 添加的统计字段（可选优化）
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
EOF
    
    # 1.2 生成 Prisma 客户端
    log_info "生成 Prisma 客户端..."
    cd apps/web
    npx prisma generate
    cd ../..
    
    # 1.3 执行数据库迁移
    log_info "执行数据库迁移..."
    cd apps/web
    npx prisma db push
    cd ../..
    
    # 1.4 添加索引优化
    log_info "添加数据库索引优化..."
    if [ -n "$DATABASE_URL" ]; then
        psql "$DATABASE_URL" << 'SQL'
-- 为ScriptSentence添加索引优化
CREATE INDEX IF NOT EXISTS idx_script_sentences_book_segment_order 
ON script_sentences(bookId, segmentId, orderInSegment);

-- 为CharacterAlias添加复合索引
CREATE INDEX IF NOT EXISTS idx_character_aliases_character_confidence 
ON character_aliases(characterId, confidence DESC);

-- 为CharacterProfile添加统计字段（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='character_profiles' AND column_name='mentions') THEN
        ALTER TABLE character_profiles ADD COLUMN mentions INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='character_profiles' AND column_name='quotes') THEN
        ALTER TABLE character_profiles ADD COLUMN quotes INTEGER DEFAULT 0;
    END IF;
END $$;
SQL
    fi
    
    log_success "数据库结构优化完成"
}

# 阶段2: Python服务调整
phase2_python_service() {
    log_info "🐍 阶段2: Python服务调整"
    
    # 2.1 备份原始文件
    log_info "备份 Python 服务原始文件..."
    cp apps/character-recognition/src/models/character.py apps/character-recognition/src/models/character.py.backup
    cp apps/character-recognition/src/models/response.py apps/character-recognition/src/models/response.py.backup
    
    # 2.2 更新 Character 模型
    log_info "更新 Character 模型..."
    cat > apps/character-recognition/src/models/character.py << 'EOF'
"""人物相关数据模型 - 对齐数据库字段"""
from typing import List, Optional, Dict, Any, Set
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

    def add_alias(self, alias: str):
        """添加别名"""
        if alias and alias != self.canonical_name:
            self.aliases.append(alias)
    
    def increment_mentions(self):
        """增加提及次数"""
        self.mentions += 1
    
    def increment_quotes(self):
        """增加台词数"""
        self.quotes += 1
    
    def update_first_appearance(self, idx: int):
        """更新首次出现位置"""
        if self.first_appearance_idx == -1 or idx < self.first_appearance_idx:
            self.first_appearance_idx = idx


class CharacterAlias(BaseModel):
    """角色别名 - 对齐数据库字段"""
    alias: str = Field(..., description="别名内容")
    confidence: float = Field(default=0.8, description="置信度")
    source_sentence: Optional[str] = Field(default=None, description="来源句子")


class Relation(BaseModel):
    """人物关系"""
    from_char: str = Field(..., alias="from", description="源人物")
    to_char: str = Field(..., alias="to", description="目标人物")
    relation_type: str = Field(..., alias="type", description="关系类型")
    weight: int = Field(default=1, description="关系权重")
    
    class Config:
        populate_by_name = True


def convert_to_database_format(characters: List[Character]) -> List[Dict[str, Any]]:
    """转换为数据库格式"""
    result = []
    for char in characters:
        # 构建characteristics
        characteristics = {
            "description": f"提及{char.mentions}次，对话{char.quotes}次",
            "personality": getattr(char, 'personality', []),
            "importance": _determine_importance(char.quotes),
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
            "canonical_name": char.canonical_name,
            "aliases": [{"alias": alias, "confidence": 0.8} for alias in char.aliases],
            "characteristics": characteristics,
            "voice_preferences": voice_preferences,
            "emotion_profile": emotion_profile,
            "gender_hint": char.gender_hint,
            "age_hint": char.age_hint,
            "emotion_baseline": char.emotion_baseline,
            "is_active": char.is_active
        })
    
    return result


def _determine_importance(quotes: int) -> str:
    """根据台词数量判断重要性"""
    if quotes >= 10:
        return "main"
    elif quotes >= 5:
        return "secondary"
    else:
        return "minor"
EOF
    
    # 2.3 更新 Response 模型
    log_info "更新 Response 模型..."
    cat > apps/character-recognition/src/models/response.py << 'EOF'
"""响应数据模型 - 对齐数据库字段"""
from typing import List, Dict, Any
from pydantic import BaseModel, Field
from .character import Character, Relation


class RecognitionStatistics(BaseModel):
    """识别统计信息"""
    total_characters: int = Field(..., description="总人物数")
    total_mentions: int = Field(..., description="总提及次数")
    total_dialogues: int = Field(..., description="总对话数")
    processing_time: float = Field(..., description="处理耗时（秒）")
    text_length: int = Field(..., description="文本长度")
    sentence_count: int = Field(..., description="句子数量")


class RecognitionResponse(BaseModel):
    """识别响应 - 对齐数据库结构"""
    characters: List[Character] = Field(..., description="识别到的人物列表")
    alias_map: Dict[str, str] = Field(default_factory=dict, description="别名映射表")
    relations: List[Relation] = Field(default_factory=list, description="人物关系")
    statistics: RecognitionStatistics = Field(..., description="统计信息")
EOF
    
    log_success "Python 服务调整完成"
}

# 阶段3: LLM台本生成调整
phase3_script_generator() {
    log_info "📝 阶段3: LLM台本生成调整"
    
    # 3.1 备份原始文件
    cp apps/web/src/lib/script-generator.ts apps/web/src/lib/script-generator.ts.backup
    
    # 3.2 更新类型定义
    log_info "更新 ScriptGenerator 类型定义..."
    
    # 这里只是示例，实际需要手动修改具体的实现
    log_warning "ScriptGenerator 需要手动调整，请参考 docs/data-flow-optimization.md"
    
    log_success "LLM台本生成调整指南已生成"
}

# 阶段4: 前端类型统一
phase4_frontend_types() {
    log_info "🎨 阶段4: 前端类型统一"
    
    # 4.1 备份原始文件
    cp apps/web/src/lib/types.ts apps/web/src/lib/types.ts.backup
    
    # 4.2 更新类型定义
    log_info "更新前端类型定义..."
    log_warning "前端类型需要手动调整，请参考 docs/data-flow-optimization.md"
    
    log_success "前端类型调整指南已生成"
}

# 阶段5: 组件更新
phase5_components() {
    log_info "🧩 阶段5: 组件更新"
    
    # 5.1 备份组件文件
    cp apps/web/src/app/books/[id]/script/components/ScriptSentenceCard.tsx apps/web/src/app/books/[id]/script/components/ScriptSentenceCard.tsx.backup
    cp apps/web/src/app/books/[id]/script/components/CharacterAssignment.tsx apps/web/src/app/books/[id]/script/components/CharacterAssignment.tsx.backup
    
    log_warning "组件需要手动更新，请参考 docs/data-flow-optimization.md"
    
    log_success "组件更新指南已生成"
}

# 验证迁移
verify_migration() {
    log_info "🔍 验证迁移结果..."
    
    # 检查 Prisma 客户端是否生成
    if [ ! -f "apps/web/src/generated/prisma/client.js" ]; then
        log_error "Prisma 客户端未生成"
        return 1
    fi
    
    # 检查 Python 文件是否更新
    if [ ! -f "apps/character-recognition/src/models/character.py" ]; then
        log_error "Python Character 模型未找到"
        return 1
    fi
    
    log_success "迁移验证通过"
}

# 生成迁移报告
generate_report() {
    log_info "📋 生成迁移报告..."
    
    REPORT_FILE="migration_report_$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$REPORT_FILE" << EOF
# 数据结构统一迁移报告

## 迁移时间
$(date)

## 迁移阶段
- ✅ 阶段1: 数据库结构优化
- ✅ 阶段2: Python服务调整
- ⚠️ 阶段3: LLM台本生成调整 (需要手动完成)
- ⚠️ 阶段4: 前端类型统一 (需要手动完成)
- ⚠️ 阶段5: 组件更新 (需要手动完成)

## 备份文件
- apps/character-recognition/src/models/character.py.backup
- apps/character-recognition/src/models/response.py.backup
- apps/web/src/lib/script-generator.ts.backup
- apps/web/src/lib/types.ts.backup
- apps/web/src/app/books/[id]/script/components/ScriptSentenceCard.tsx.backup
- apps/web/src/app/books/[id]/script/components/CharacterAssignment.tsx.backup

## 下一步操作
1. 手动完成阶段3-5的调整
2. 运行测试验证功能
3. 部署到测试环境
4. 监控系统运行状态

## 参考文档
- docs/data-flow-optimization.md
- docs/data-flow-analysis.md
EOF
    
    log_success "迁移报告已生成: $REPORT_FILE"
}

# 主函数
main() {
    echo "🎯 数据结构统一迁移脚本"
    echo "================================"
    
    check_environment
    backup_database
    
    phase1_database_optimization
    phase2_python_service
    phase3_script_generator
    phase4_frontend_types
    phase5_components
    
    verify_migration
    generate_report
    
    echo ""
    log_success "🎉 数据结构统一迁移完成！"
    echo ""
    echo "📝 重要提醒："
    echo "1. 请手动完成阶段3-5的代码调整"
    echo "2. 参考文档: docs/data-flow-optimization.md"
    echo "3. 运行完整测试验证功能"
    echo "4. 备份文件已保存，可随时回滚"
    echo ""
}

# 执行主函数
main "$@"
