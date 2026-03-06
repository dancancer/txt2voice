// 一旦我被更新，请更新我的开头注释
// input: Fast Gate 输入样本
// output: 质检判定断言
// pos: 任务执行器测试
import {
  evaluateFastGate,
  resolveReprocessingStatusFromVerdict
} from '@/lib/quality-check-runner'

describe('evaluateFastGate', () => {
  it('should pass stable narration sample', () => {
    const result = evaluateFastGate({
      text: '这是一个节奏平稳的旁白句子，用于验证质检通过路径。',
      roleType: 'narration',
      durationSeconds: 5.2,
      hasVoiceProfile: true
    })

    expect(result.verdict).toBe('pass')
    expect(result.score).toBeGreaterThanOrEqual(85)
    expect(result.hardFail).toBe(false)
  })

  it('should mark fast pace as repair', () => {
    const result = evaluateFastGate({
      text: '这是一段非常长非常长非常长非常长非常长非常长非常长非常长非常长非常长的文本',
      roleType: 'dialogue',
      durationSeconds: 4,
      hasVoiceProfile: true
    })

    expect(result.verdict).toBe('repair')
    expect(result.reasons).toContain('pace_too_fast')
    expect(result.repairPlan).toContain('decrease_speed_0.05')
  })

  it('should hard fail when duration is invalid', () => {
    const result = evaluateFastGate({
      text: '异常时长样本',
      roleType: 'dialogue',
      durationSeconds: 0,
      hasVoiceProfile: false
    })

    expect(result.verdict).toBe('hard_fail')
    expect(result.hardFail).toBe(true)
    expect(result.reasons).toContain('invalid_duration')
  })

  it('should route dialogue without voice profile to manual review', () => {
    const result = evaluateFastGate({
      text: '你是谁？',
      roleType: 'dialogue',
      durationSeconds: 6,
      hasVoiceProfile: false
    })

    expect(result.verdict).toBe('manual_review')
    expect(result.reasons).toContain('voice_profile_missing_for_dialogue')
  })
})

describe('resolveReprocessingStatusFromVerdict', () => {
  it('should resolve when verdict is pass/repair', () => {
    expect(resolveReprocessingStatusFromVerdict('pass')).toEqual({
      status: 'resolved',
      resolutionType: 'auto_resolved'
    })
    expect(resolveReprocessingStatusFromVerdict('repair')).toEqual({
      status: 'resolved',
      resolutionType: 'auto_resolved'
    })
  })

  it('should reject when verdict requires manual intervention', () => {
    expect(resolveReprocessingStatusFromVerdict('manual_review')).toEqual({
      status: 'rejected',
      resolutionType: 'auto_rejected'
    })
    expect(resolveReprocessingStatusFromVerdict('hard_fail')).toEqual({
      status: 'rejected',
      resolutionType: 'auto_rejected'
    })
  })
})
