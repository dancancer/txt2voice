# Script Prosody Design

**目标**

让 LLM 台本生成阶段直接产出可落盘的语气与朗读参数，补齐当前缺失的：

1. `tone`
2. `prosody`
3. `strength`
4. `pauseAfter`

这样段落台本从生成、修复、归一化、持久化到 TTS 路由会形成一条完整闭环，而不是依赖后置默认值兜底。

**背景**

当前链路已经具备后半段能力：

1. `DialogueLine` 支持 `tone / emotionLabel / emotionIntensity / prosody / strength / pauseAfter`
2. `buildSentenceData()` 会把这些字段写入 `ScriptSentence`
3. 音频路由与 TTS 请求构建也已经读取这些字段

但前半段仍然停留在极简契约：

1. `SegmentScriptDraftLine` 只定义 `id / sourceText / text / speaker / orderInSegment`
2. `script-generation` prompt 只要求 LLM 输出上述最小字段
3. `repair-agent` 解析器也只接受上述最小字段
4. `mapSegmentScriptDraftToDialogueLines()` 不会把语气信息从 draft 透传到 `DialogueLine`

结果是：

1. 语气信息不是“没有展示”，而是“根本没生成”
2. 持久化层只能退回默认情绪映射与默认 prosody
3. 下游虽然有字段，但上游语义缺位

## 设计原则

1. 只补齐现有闭环，不新造语义层
   - 直接复用已存在的 `tone / prosody / strength / pauseAfter`
   - 不引入新的 `emotion` 顶层对象，避免并行语义源

2. 保持兼容
   - 新字段全部为可选
   - 老的最小 JSON 仍可被解析
   - 未给出语气时，现有默认值策略继续生效

3. 消除特殊情况，而不是堆分支
   - parser、normalizer、persistence 都按“可选透传”处理
   - 不对“旁白”与“对白”分出两套数据结构

4. 让 repair 与 generation 共用同一契约
   - 否则修复链会把新字段再丢一次

## 范围

### 本次要做

1. 扩展 `SegmentScriptDraftLine` 契约，允许携带语气与朗读参数
2. 更新 `script-generation` prompt，要求 LLM 为每句生成可选语气信息
3. 更新 `repair-agent` 解析器，接受同一批新字段
4. 让 `normalizeSegmentScriptDraft()` 在归一化过程中保留这些字段
5. 让 `mapSegmentScriptDraftToDialogueLines()` 把字段透传到 `DialogueLine`
6. 用单元测试锁住兼容性与透传行为

### 本次不做

1. 不新增数据库字段
2. 不修改 TTS provider 协议
3. 不新增单独的情绪模型调用
4. 不在本次引入更复杂的 `emotionLabel` 直接生成策略

## 总体方案

整体拆成四个薄层：

1. **契约层**
   - 在 `SegmentScriptDraftLine` 上增加可选字段
   - parser 接受并校验新字段

2. **prompt 层**
   - 明确语气字段语义
   - 约束输出格式，避免 LLM 漫天发挥

3. **归一化层**
   - 文本切分、引用修正、旁白修复时保留元字段
   - 不让“拆行”把 tone/prosody 丢失

4. **持久化映射层**
   - draft line -> dialogue line 透传新字段
   - 现有 `buildSentenceData()` 继续负责最终数据库默认值

---

## 一、契约扩展

### 现状

`SegmentScriptDraftLine` 过于瘦，只能承载“谁说了什么”，不能承载“怎么说”。

### 设计决策

把以下字段提升为一等公民，但全部保持可选：

1. `tone?: string`
2. `prosody?: { pace?: number; pitch?: number; energy?: number; pauseMsAfter?: number }`
3. `strength?: number`
4. `pauseAfter?: number`

### 原因

1. 这些字段已经被 `DialogueLine` 与持久化层使用
2. 可选字段天然兼容历史 payload
3. 这比单独引入新对象更简单

## 二、Prompt 输出约束

### 设计决策

让 `script-generation` prompt 生成：

1. `tone`
   - 简短中文标签，例如“平静”“急促”“压低声音”“冷淡”
2. `prosody`
   - 仅在有明显朗读指向时输出
   - 子字段限定为 `pace / pitch / energy / pauseMsAfter`
3. `strength`
   - 0 到 100
4. `pauseAfter`
   - 秒数

### 约束策略

1. 没把握时可以省略，不要编造复杂数值
2. `prosody` 只允许白名单字段
3. 旁白和对白都允许有语气，但旁白通常更克制

### 原因

这能把模型输出限制在后端现有可消费的形状内，避免 repair 阶段不断修 JSON。

## 三、归一化层如何保留字段

### 风险

当前 `normalizeSegmentScriptDraft()` 会：

1. 拆分混合叙事/对白
2. 纠正错误引号边界
3. 重排行号

如果只复制基础字段，新增语气信息会在这些变换里丢失。

### 设计决策

1. 所有 line 级变换保持对象扩展拷贝
2. 新生成的拆分行沿用原行语气信息
3. 只有文本与 speaker 明确变化时才改对应字段

### 原因

语气信息在一条混合句被拆成“叙事 + 对白”时虽然未必完美，但“保留并允许后续人工修正”优于“直接丢失”。

## 四、持久化透传

### 现状

`mapSegmentScriptDraftToDialogueLines()` 只构造：

1. `characterName`
2. `rawSpeaker`
3. `text`
4. `orderInSegment`
5. `isNarration`

### 设计决策

在这一层直接透传：

1. `tone`
2. `prosody`
3. `strength`
4. `pauseAfter`

### 结果

后面的 `buildSentenceData()` 将：

1. 用 `tone` 生成默认 `emotionLabel`
2. 用 `strength` 生成默认 `emotionIntensity`
3. 优先使用 LLM 给出的 `prosody / pauseAfter`
4. 仅在缺失时回退默认值

## 五、兼容性策略

### 历史数据

历史 LLM 返回如果没有新字段，应继续成功。

### repair 链

repair agent 若不同时更新，会把新字段在修复时抹掉，所以必须同步扩展。

### 测试保障

至少锁住三类行为：

1. 老 payload 仍能通过
2. 新 payload 会被完整解析
3. 新字段能一路透传到 `DialogueLine`

## 六、风险与控制

### 风险 1：LLM 输出数值过度发散

控制：

1. prompt 限定字段白名单
2. parser 只接受有限形状
3. 非法值按缺失处理，而不是让整段失败

### 风险 2：normalizer 拆分时复制了不完全准确的语气

控制：

1. 本次优先保证“不断链”
2. 后续如果发现拆分后的语气污染，再针对 split helper 做局部收敛

### 风险 3：repair / generation 契约不一致

控制：

1. 两边共用同一组可选字段
2. 用测试覆盖 repair 解析路径

## 结论

这次改动的本质不是“多加几个字段”，而是把“怎么说”提升为台本生成的一等语义，让当前已经存在的持久化与 TTS 能真正消费到 LLM 产出的语气信息。最小而正确的切口，就是从 `SegmentScriptDraftLine` 开始，把 `tone + prosody + strength + pauseAfter` 一路打通。
