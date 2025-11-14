/**
 * 测试文本分段器
 */

import { SmartTextSplitter, splitTextSmartly, calculateSmartLength } from './smart-text-splitter.js'

// 创建测试文本（模拟小说内容）
const testNovelText = `
第一章 开始

这是小说的开头。主人公张三走在街上，看到了许多有趣的事情。

"你好，"他说，"今天天气真好。"

"是啊，"李四回答，"我们一起去公园吧。"

于是他们一起走向公园。公园里有很多花，有红色的、黄色的、蓝色的。张三感到非常开心。

突然，天空中传来一声巨响。他们抬头一看，发现是一架飞机。

"那是什么？"张三好奇地问。

"好像是军用飞机，"李四说，"平时很少看到。"

他们继续走着，讨论着刚才看到的飞机。不知不觉中，他们已经走到了公园门口。

公园门口有一个告示牌，上面写着："今日开放时间：8:00-18:00"。

"还好没有关门，"张三松了一口气，"我们可以好好玩了。"

第二章 发展

第二天，张三又来到了公园。这次他遇到了王五。

"早上好，"王五打招呼说。

"早上好，"张三回应道，"今天又是个好天气。"

"是的，很适合晨练。"王五一边说一边做着伸展运动。

张三也加入了晨练的队伍。他们一起跑步、做操，度过了一个愉快的早晨。

晨练结束后，王五邀请张三去吃早餐。

"我知道附近有一家很不错的包子铺，"王五说。

"好啊，我正好有点饿了。"张三同意了。

他们来到了包子铺，点了几笼热腾腾的包子和豆浆。

"这包子真好吃，"张三赞叹道。

"是啊，我经常来这里。"王五笑着说。

吃完早餐后，他们各自去上班了。

第三章 转折

一周后，张三在公园里遇到了一个神秘的女孩。

女孩穿着白色的连衣裙，长发飘飘，看起来非常美丽。

"你好，"女孩主动打招呼。

"你好，"张三有些惊讶地回应。

"我能在这里坐一下吗？"女孩指着旁边的长椅问道。

"当然可以，"张三连忙让开位置。

女孩坐了下来，从包里拿出一本书开始阅读。

张三好奇地看了看书的封面，是一本他从未见过的书。

"你在看什么书？"张三忍不住问道。

"这是一本关于旅行的书，"女孩微笑着回答，"我很喜欢旅行。"

"旅行？"张三很感兴趣，"你都去过哪些地方？"

"我去过很多地方，比如北京、上海、西安、成都等等。"女孩数着手指说。

"那一定很有趣吧。"张三羡慕地说。

"是的，每次旅行都有不同的收获。"女孩说着，眼睛里闪烁着光芒。

他们聊了很久，从旅行聊到生活，从梦想聊到未来。

第四章 结局

从那以后，张三和女孩经常在公园见面。

他们一起去过很多地方，看过很多风景。

半年后，张三向女孩表白了。

"我喜欢你，"张三鼓起勇气说。

女孩红着脸点了点头："我也是。"

他们开始了幸福的恋爱生活。

一年后，他们结婚了。

婚礼就在公园举行，那里是他们第一次相遇的地方。

许多朋友都来参加了婚礼，包括李四和王五。

"真为你们高兴，"李四举杯祝贺。

"谢谢你们来参加我们的婚礼，"张三激动地说。

婚礼很成功，大家都很开心。

从此，张三和女孩过上了幸福快乐的生活。

他们经常回到公园，回忆起第一次相遇的那个下午。

那是一个美丽的下午，阳光正好，微风不燥。

一切都像命中注定一样美好。

（完）
`

console.log('=== 测试智能文本分段器 ===')
console.log('原始文本长度:', calculateSmartLength(testNovelText))
console.log('原始文本前100字:', testNovelText.substring(0, 100) + '...')

// 测试不同配置的分段效果
const testConfigs = [
  { name: '默认配置', options: {} },
  { name: '严格500字限制', options: { maxLength: 500, targetLength: 400, minLength: 100 } },
  { name: '较小段落', options: { maxLength: 300, targetLength: 200, minLength: 50 } },
  { name: '较大段落', options: { maxLength: 800, targetLength: 600, minLength: 200 } }
]

testConfigs.forEach((config, index) => {
  console.log(`\n=== 测试配置 ${index + 1}: ${config.name} ===`)

  const segments = splitTextSmartly(testNovelText, config.options)

  console.log(`段落数量: ${segments.length}`)

  segments.forEach((segment, segIndex) => {
    console.log(`段落 ${segIndex + 1}:`)
    console.log(`  长度: ${segment.length} 字`)
    console.log(`  分段原因: ${segment.metadata?.breakReason || '未知'}`)
    console.log(`  内容前50字: ${segment.content.substring(0, 50)}...`)
  })

  // 统计分析
  const lengths = segments.map(s => s.length)
  const avgLength = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
  const minLength = Math.min(...lengths)
  const maxLength = Math.max(...lengths)

  console.log(`统计信息:`)
  console.log(`  平均长度: ${avgLength} 字`)
  console.log(`  最短段落: ${minLength} 字`)
  console.log(`  最长段落: ${maxLength} 字`)
  console.log(`  长度标准差: ${Math.round(Math.sqrt(lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length))} 字`)
})