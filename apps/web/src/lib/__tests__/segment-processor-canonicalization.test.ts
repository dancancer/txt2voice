// 一旦我被更新，请更新我的开头注释
// input: 已通过校验的台本行/LLM mock/落库 mock
// output: canonical split 断言
// pos: Phase 1 sentence canonicalization 测试
jest.mock("@/lib/script-generator/storage/persistence", () => ({
  saveSegmentScriptToDatabase: jest.fn(),
}));

jest.mock("@/lib/script-generator/storage/character-utils", () => {
  const actual = jest.requireActual("@/lib/script-generator/storage/character-utils");
  return {
    ...actual,
    upsertCharacterCandidates: jest.fn(),
  };
});

import { processSegmentAndSave } from "../script-generator/pipeline/segment-processor";

const options = {
  includeNarration: true,
  emotionDetection: true,
  contextAnalysis: true,
  minDialogueLength: 1,
  maxDialogueLength: 200,
  preserveOriginalBreaks: true,
};

describe("segment processor canonicalization", () => {
  it("should canonicalize narration granularity and split attributed dialogue prefix", async () => {
    const llmService = {
      callLLM: jest.fn().mockResolvedValue(
        JSON.stringify({
          dialogues: [
            {
              id: "line-1",
              sourceText:
                "红衣女子十八九岁容颜，柔纱丝袍堪堪散在肩膀上，露出晶莹剔透的脖颈。朱砂小口，双眼如凉泉，色绝天下的一张脸，饶是殿中侍女多看几眼也忍不住面红心跳，唯独眉梢眼角有些不易察觉的锋锐。女子赤着脚，鬓乱钗斜，一副刚刚睡醒模样，慵懒如一汪醇酒。不过此地没人敢置喙于她，女子亦不会在乎什么指摘。",
              text:
                "红衣女子十八九岁容颜，柔纱丝袍堪堪散在肩膀上，露出晶莹剔透的脖颈。朱砂小口，双眼如凉泉，色绝天下的一张脸，饶是殿中侍女多看几眼也忍不住面红心跳，唯独眉梢眼角有些不易察觉的锋锐。女子赤着脚，鬓乱钗斜，一副刚刚睡醒模样，慵懒如一汪醇酒。不过此地没人敢置喙于她，女子亦不会在乎什么指摘。",
              speaker: "旁白",
              tone: "中性",
            },
            {
              id: "line-2",
              sourceText: "她往殿中黄金大榻一靠，抬手轻挥：“人多心乱，都撤了吧。”",
              text: "人多心乱，都撤了吧。",
              speaker: "未知",
              tone: "平静",
            },
            {
              id: "line-3",
              sourceText: "闵弘芳又一拍手，侍女们便快步消失在了侧门之外。",
              text: "闵弘芳又一拍手，侍女们便快步消失在了侧门之外。",
              speaker: "旁白",
              tone: "中性",
            },
            {
              id: "line-4",
              sourceText: "女子手指一勾，两道真气如臂使指，卷来指肚大小小一尾细烹银鱼。",
              text: "女子手指一勾，两道真气如臂使指，卷来指肚大小小一尾细烹银鱼。",
              speaker: "旁白",
              tone: "中性",
            },
          ],
          characters: [],
        })
      ),
    };

    const result = await processSegmentAndSave({
      llmService,
      segment: {
        id: "segment-canonical-1",
        chapterId: "chapter-1",
        orderIndex: 1,
        content:
          "红衣女子十八九岁容颜，柔纱丝袍堪堪散在肩膀上，露出晶莹剔透的脖颈。朱砂小口，双眼如凉泉，色绝天下的一张脸，饶是殿中侍女多看几眼也忍不住面红心跳，唯独眉梢眼角有些不易察觉的锋锐。女子赤着脚，鬓乱钗斜，一副刚刚睡醒模样，慵懒如一汪醇酒。不过此地没人敢置喙于她，女子亦不会在乎什么指摘。她往殿中黄金大榻一靠，抬手轻挥：“人多心乱，都撤了吧。”闵弘芳又一拍手，侍女们便快步消失在了侧门之外。女子手指一勾，两道真气如臂使指，卷来指肚大小小一尾细烹银鱼。",
      },
      characterMap: new Map<string, string>(),
      characterProfiles: [],
      options,
      bookId: "book-1",
    });

    expect(result.dialogueLines.map((line) => [line.rawSpeaker, line.text])).toEqual([
      ["旁白", "红衣女子十八九岁容颜，柔纱丝袍堪堪散在肩膀上，露出晶莹剔透的脖颈。"],
      ["旁白", "朱砂小口，双眼如凉泉，色绝天下的一张脸，饶是殿中侍女多看几眼也忍不住面红心跳，唯独眉梢眼角有些不易察觉的锋锐。"],
      ["旁白", "女子赤着脚，鬓乱钗斜，一副刚刚睡醒模样，慵懒如一汪醇酒。"],
      ["旁白", "不过此地没人敢置喙于她，女子亦不会在乎什么指摘。"],
      ["旁白", "她往殿中黄金大榻一靠，抬手轻挥："],
      ["未知", "人多心乱，都撤了吧。"],
      ["旁白", "闵弘芳又一拍手，侍女们便快步消失在了侧门之外。"],
      ["旁白", "女子手指一勾，两道真气如臂使指，卷来指肚大小小一尾细烹银鱼。"],
    ]);
  });

  it("should canonicalize trailing speaker labels into narration plus dialogue", async () => {
    const llmService = {
      callLLM: jest.fn().mockResolvedValue(
        JSON.stringify({
          dialogues: [
            {
              id: "line-1",
              sourceText:
                "宁尘那嘴就跟抹着迷魂药一样，也不知和人家说些啥，总能大事化小小事化了。真要打也敢打，打完了巡查堂一来，保准让他编个天花乱坠，对头们讨不得半分好处。赶上他又会来事儿，三五回下来跟巡查堂几个内门弟子混得那叫一个热乎。念着他的好，灵宝堂的外门弟子也没法儿说三道四。不就是搓两件衣服么！搓！搓还不行吗！宁尘嗑完最后一颗瓜子儿，打么打么手，起来伸了个懒腰。",
              text:
                "宁尘那嘴就跟抹着迷魂药一样，也不知和人家说些啥，总能大事化小小事化了。真要打也敢打，打完了巡查堂一来，保准让他编个天花乱坠，对头们讨不得半分好处。赶上他又会来事儿，三五回下来跟巡查堂几个内门弟子混得那叫一个热乎。念着他的好，灵宝堂的外门弟子也没法儿说三道四。不就是搓两件衣服么！搓！搓还不行吗！宁尘嗑完最后一颗瓜子儿，打么打么手，起来伸了个懒腰。",
              speaker: "旁白",
              tone: "中性",
            },
            {
              id: "line-2",
              sourceText: "“耿老大，搓完衣服记得抻平整儿了再晾，昂！”",
              text: "耿老大，搓完衣服记得抻平整儿了再晾，昂！",
              speaker: "宁尘",
              tone: "得意",
            },
            {
              id: "line-3",
              sourceText: "耿魄：“你他娘……”",
              text: "你他娘……",
              speaker: "耿魄",
              tone: "恼火",
            },
          ],
          characters: [],
        })
      ),
    };

    const result = await processSegmentAndSave({
      llmService,
      segment: {
        id: "segment-canonical-2",
        chapterId: "chapter-1",
        orderIndex: 9,
        content:
          "宁尘那嘴就跟抹着迷魂药一样，也不知和人家说些啥，总能大事化小小事化了。真要打也敢打，打完了巡查堂一来，保准让他编个天花乱坠，对头们讨不得半分好处。赶上他又会来事儿，三五回下来跟巡查堂几个内门弟子混得那叫一个热乎。念着他的好，灵宝堂的外门弟子也没法儿说三道四。不就是搓两件衣服么！搓！搓还不行吗！宁尘嗑完最后一颗瓜子儿，打么打么手，起来伸了个懒腰。“耿老大，搓完衣服记得抻平整儿了再晾，昂！”耿魄：“你他娘……”",
      },
      characterMap: new Map<string, string>(),
      characterProfiles: [],
      options,
      bookId: "book-1",
    });

    expect(result.dialogueLines.slice(-3).map((line) => [line.rawSpeaker, line.text])).toEqual([
      ["宁尘", "耿老大，搓完衣服记得抻平整儿了再晾，昂！"],
      ["旁白", "耿魄："],
      ["耿魄", "你他娘……"],
    ]);
  });
});
