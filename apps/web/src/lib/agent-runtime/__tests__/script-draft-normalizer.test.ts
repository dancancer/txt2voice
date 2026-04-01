import { normalizeSegmentScriptDraft } from "../runtime/script-production/helpers/script-draft-normalizer";

describe("script draft normalizer", () => {
  it("should normalize narration-labelled pure quoted dialogue into unknown speaker", () => {
    const draft = normalizeSegmentScriptDraft({
      segmentText: "“无事，只想叫叫你。”",
      draft: {
        segmentId: "segment-1",
        createdAt: "2026-03-30T00:00:00.000Z",
        lines: [
          {
            id: "line-1",
            sourceText: "“无事，只想叫叫你。”",
            text: "无事，只想叫叫你。",
            speaker: "旁白",
            orderInSegment: 0,
          },
        ],
      },
    });

    expect(draft.lines[0]).toEqual({
      id: "line-1",
      sourceText: "“无事，只想叫叫你。”",
      text: "无事，只想叫叫你。",
      speaker: "未知",
      orderInSegment: 0,
    });
  });

  it("should restore quoted sourceText when the segment itself is a pure quoted leaf", () => {
    const draft = normalizeSegmentScriptDraft({
      segmentText: "“宁尘。”",
      draft: {
        segmentId: "segment-2",
        createdAt: "2026-03-30T00:00:00.000Z",
        lines: [
          {
            id: "line-1",
            sourceText: "宁尘。",
            text: "宁尘。",
            speaker: "旁白",
            orderInSegment: 0,
          },
        ],
      },
    });

    expect(draft.lines[0]).toEqual({
      id: "line-1",
      sourceText: "“宁尘。”",
      text: "宁尘。",
      speaker: "未知",
      orderInSegment: 0,
    });
  });

  it("should keep exact narration lines unchanged", () => {
    const draft = normalizeSegmentScriptDraft({
      segmentText: "龙雅歌也不说话，只是由他抱着躺在那里。",
      draft: {
        segmentId: "segment-3",
        createdAt: "2026-03-30T00:00:00.000Z",
        lines: [
          {
            id: "line-1",
            sourceText: "龙雅歌也不说话，只是由他抱着躺在那里。",
            text: "龙雅歌也不说话，只是由他抱着躺在那里。",
            speaker: "旁白",
            orderInSegment: 0,
          },
        ],
      },
    });

    expect(draft.lines[0]).toEqual({
      id: "line-1",
      sourceText: "龙雅歌也不说话，只是由他抱着躺在那里。",
      text: "龙雅歌也不说话，只是由他抱着躺在那里。",
      speaker: "旁白",
      orderInSegment: 0,
    });
  });

  it("should split mixed narration and dialogue sourceText into coverage-safe lines", () => {
    const draft = normalizeSegmentScriptDraft({
      segmentText:
        "宁尘嬉皮笑脸给他们推走了，拉着程婉就来到当中大桌。“以后就在这儿吃，别跟个偷粮食的小耗子似的。”",
      draft: {
        segmentId: "segment-4",
        createdAt: "2026-03-30T00:00:00.000Z",
        lines: [
          {
            id: "line-1",
            sourceText:
              "宁尘嬉皮笑脸给他们推走了，拉着程婉就来到当中大桌。“以后就在这儿吃，别跟个偷粮食的小耗子似的。”",
            text: "以后就在这儿吃，别跟个偷粮食的小耗子似的。",
            speaker: "宁尘",
            orderInSegment: 0,
          },
        ],
      },
    });

    expect(draft.lines).toEqual([
      {
        id: "line-1::narration-1",
        sourceText: "宁尘嬉皮笑脸给他们推走了，拉着程婉就来到当中大桌。",
        text: "宁尘嬉皮笑脸给他们推走了，拉着程婉就来到当中大桌。",
        speaker: "旁白",
        orderInSegment: 0,
      },
      {
        id: "line-1::dialogue-1",
        sourceText: "“以后就在这儿吃，别跟个偷粮食的小耗子似的。”",
        text: "以后就在这儿吃，别跟个偷粮食的小耗子似的。",
        speaker: "宁尘",
        orderInSegment: 1,
      },
    ]);
  });

  it("should recover dialogue from malformed quoted narration shell before validation", () => {
    const draft = normalizeSegmentScriptDraft({
      segmentText:
        "“正是！”穆天香抬起头还没说话，就瞧见龙雅歌斜身后的宁尘。宁尘这些日子身量高了，修为上了凝心，又换了一副面孔，穆天香哪里识得出他，只道龙雅歌在身边新养了个小白脸。“宗主……您分神期修为，怎忽地动起了凡欲尘心，只怕这样下去有损修行。您是一宗主心之人，只盼能以宗门为先，远小人亲贤者……“龙雅歌心知穆天香看出自己身形虚浮，一时间也不知如何解释，便沉下脸来故作不快：“穆阁主，这些闲话日后再说，问你的还没答呢。“穆天香点点头，从乾坤袖中翻出一封请柬：“请宗主阅之。“龙雅歌接过纸来，低头望去，不一会儿便皱起了眉头。",
      draft: {
        segmentId: "segment-5",
        createdAt: "2026-03-31T06:20:57.518Z",
        lines: [
          {
            id: "line-0",
            sourceText:
              "“龙雅歌心知穆天香看出自己身形虚浮，一时间也不知如何解释，便沉下脸来故作不快：“穆阁主，这些闲话日后再说，问你的还没答呢。",
            text:
              "龙雅歌心知穆天香看出自己身形虚浮，一时间也不知如何解释，便沉下脸来故作不快：“穆阁主，这些闲话日后再说，问你的还没答呢。",
            speaker: "旁白",
            orderInSegment: 0,
          },
        ],
      },
    });

    expect(draft.lines[0]).toEqual({
      id: "line-0",
      sourceText:
        "“龙雅歌心知穆天香看出自己身形虚浮，一时间也不知如何解释，便沉下脸来故作不快：“穆阁主，这些闲话日后再说，问你的还没答呢。",
      text: "穆阁主，这些闲话日后再说，问你的还没答呢。",
      speaker: "未知",
      orderInSegment: 0,
    });
  });

  it("should split adjacent malformed quote shell into narration prefix and dialogue tail", () => {
    const draft = normalizeSegmentScriptDraft({
      segmentText:
        '“穆天香点点头，从乾坤袖中翻出一封请柬：“请宗主阅之。',
      draft: {
        segmentId: "segment-6",
        createdAt: "2026-03-31T06:41:53.661Z",
        lines: [
          {
            id: "1",
            sourceText: '“穆天香点点头，从乾坤袖中翻出一封请柬：“请宗主阅之。',
            text: '穆天香点点头，从乾坤袖中翻出一封请柬：',
            speaker: "旁白",
            orderInSegment: 0,
          },
          {
            id: "2",
            sourceText: "请宗主阅之。",
            text: "请宗主阅之。",
            speaker: "穆天香",
            orderInSegment: 1,
          },
        ],
      },
    });

    expect(draft.lines).toEqual([
      {
        id: "1",
        sourceText: "穆天香点点头，从乾坤袖中翻出一封请柬：",
        text: "穆天香点点头，从乾坤袖中翻出一封请柬：",
        speaker: "旁白",
        orderInSegment: 0,
      },
      {
        id: "2",
        sourceText: "请宗主阅之。",
        text: "请宗主阅之。",
        speaker: "穆天香",
        orderInSegment: 1,
      },
    ]);
  });

  it("should convert unknown malformed quoted narration boundary into narrator coverage-safe line", () => {
    const draft = normalizeSegmentScriptDraft({
      segmentText:
        "“龙雅歌心知穆天香看出自己身形虚浮，一时间也不知如何解释，便沉下脸来故作不快：",
      draft: {
        segmentId: "segment-7",
        createdAt: "2026-03-31T06:51:44.853Z",
        lines: [
          {
            id: "line-9",
            sourceText:
              "“龙雅歌心知穆天香看出自己身形虚浮，一时间也不知如何解释，便沉下脸来故作不快：",
            text:
              "龙雅歌心知穆天香看出自己身形虚浮，一时间也不知如何解释，便沉下脸来故作不快：",
            speaker: "未知",
            orderInSegment: 0,
          },
        ],
      },
    });

    expect(draft.lines[0]).toEqual({
      id: "line-9",
      sourceText:
        "龙雅歌心知穆天香看出自己身形虚浮，一时间也不知如何解释，便沉下脸来故作不快：",
      text:
        "龙雅歌心知穆天香看出自己身形虚浮，一时间也不知如何解释，便沉下脸来故作不快：",
      speaker: "旁白",
      orderInSegment: 0,
    });
  });

  it("should merge fragmented dialogue continuation runs before later narration", () => {
    const draft = normalizeSegmentScriptDraft({
      segmentText:
        "“宗主……您分神期修为，怎忽地动起了凡欲尘心，只怕这样下去有损修行。您是一宗主心之人，只盼能以宗门为先，远小人亲贤者……“龙雅歌心知穆天香看出自己身形虚浮，一时间也不知如何解释，便沉下脸来故作不快：“穆阁主，这些闲话日后再说，问你的还没答呢。",
      draft: {
        segmentId: "segment-8",
        createdAt: "2026-03-31T06:51:44.853Z",
        lines: [
          {
            id: "line-4",
            sourceText: "“宗主…",
            text: "宗主…",
            speaker: "未知",
            orderInSegment: 0,
          },
          {
            id: "line-5",
            sourceText: "…",
            text: "…",
            speaker: "旁白",
            orderInSegment: 1,
          },
          {
            id: "line-6",
            sourceText: "您分神期修为，怎忽地动起了凡欲尘心，只怕这样下去有损修行。",
            text: "您分神期修为，怎忽地动起了凡欲尘心，只怕这样下去有损修行。",
            speaker: "旁白",
            orderInSegment: 2,
          },
          {
            id: "line-7",
            sourceText: "您是一宗主心之人，只盼能以宗门为先，远小人亲贤者…",
            text: "您是一宗主心之人，只盼能以宗门为先，远小人亲贤者…",
            speaker: "旁白",
            orderInSegment: 3,
          },
          {
            id: "line-8",
            sourceText: "…",
            text: "…",
            speaker: "旁白",
            orderInSegment: 4,
          },
          {
            id: "line-9",
            sourceText:
              "“龙雅歌心知穆天香看出自己身形虚浮，一时间也不知如何解释，便沉下脸来故作不快：",
            text:
              "龙雅歌心知穆天香看出自己身形虚浮，一时间也不知如何解释，便沉下脸来故作不快：",
            speaker: "未知",
            orderInSegment: 5,
          },
          {
            id: "line-10",
            sourceText: "“穆阁主，这些闲话日后再说，问你的还没答呢。",
            text: "穆阁主，这些闲话日后再说，问你的还没答呢。",
            speaker: "龙雅歌",
            orderInSegment: 6,
          },
        ],
      },
    });

    expect(draft.lines).toEqual([
      {
        id: "line-4",
        sourceText:
          "“宗主……您分神期修为，怎忽地动起了凡欲尘心，只怕这样下去有损修行。您是一宗主心之人，只盼能以宗门为先，远小人亲贤者……",
        text:
          "宗主……您分神期修为，怎忽地动起了凡欲尘心，只怕这样下去有损修行。您是一宗主心之人，只盼能以宗门为先，远小人亲贤者……",
        speaker: "未知",
        orderInSegment: 0,
      },
      {
        id: "line-9",
        sourceText:
          "龙雅歌心知穆天香看出自己身形虚浮，一时间也不知如何解释，便沉下脸来故作不快：",
        text:
          "龙雅歌心知穆天香看出自己身形虚浮，一时间也不知如何解释，便沉下脸来故作不快：",
        speaker: "旁白",
        orderInSegment: 1,
      },
      {
        id: "line-10",
        sourceText: "“穆阁主，这些闲话日后再说，问你的还没答呢。",
        text: "穆阁主，这些闲话日后再说，问你的还没答呢。",
        speaker: "龙雅歌",
        orderInSegment: 2,
      },
    ]);
  });
});
