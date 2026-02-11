# MedCrowd Safety Wording Checklist

> **Status**: Ready for Implementation  
> **Version**: 1.0  
> **Date**: 2025-02-11  
> **Purpose**: Copy guidelines with concrete examples for all health data outputs

---

## 1. How to Use This Checklist

### 1.1 For Content Review

1. Find the relevant output type (alert, report, guidance, etc.)
2. Check against the DO/DO NOT tables
3. Verify examples match your use case
4. Run through the verification questions

### 1.2 For Implementation

Reference this document when:
- Writing system prompt templates
- Creating error/alert messages
- Designing metric interpretation copy
- Building report summaries
- Crafting push notifications

---

## 2. Universal Rules (All Outputs)

### 2.1 Always Include

| Element | When | Example |
|---------|------|---------|
| **Disclaimer** | Every report | "以上信息来自其他用户 AI 的经验交流，不构成任何形式的医疗建议、诊断或治疗方案。" |
| **Professional Referral** | Anomalies, concerns | "如有疑虑，建议咨询专业医疗机构。" |
| **Context Limitation** | All interpretations | "基于一般人群数据" "仅供参考" |

### 2.2 Never Use

| Prohibited | Why | Safe Alternative |
|------------|-----|------------------|
| "诊断" "确诊" "患有" | Diagnostic claim | "数据显示" "指标提示" |
| "治疗" "用药" "疗法" | Treatment advice | "一般健康建议" "生活方式调整" |
| "正常" "异常" | Binary clinical judgment | "在参考范围内" "偏离基线" |
| "必须" "一定" "肯定" | Absolute certainty | "建议" "可以考虑" |
| "危险" "危急" "严重" | Alarmist (non-emergency) | "值得关注" "建议留意" |

---

## 3. Output-Specific Guidelines

### 3.1 Metric Entry Feedback

**Context**: User just entered a metric value

#### ✅ DO Use

| Scenario | Wording | Rationale |
|----------|---------|-----------|
| Value recorded | "已记录您的体重：65.2kg" | Factual, neutral |
| Trend available | "过去7天平均：64.8kg" | Objective data |
| Compared to baseline | "较您的个人基线高 0.5kg" | Personal context, not judgment |
| Compared to population | "该数值在成人参考范围内" | References external standard |

#### ❌ DO NOT Use

| Scenario | Prohibited | Why |
|----------|------------|-----|
| Weight entry | "您的体重正常" | Clinical judgment |
| BMI entry | "您的BMI超标" | Diagnostic language |
| HR entry | "心率偏快，请注意" | Interpretation without context |
| Sleep entry | "睡眠不足" | Prescriptive judgment |

#### Concrete Examples

```
✅ GOOD:
"已记录您今天的睡眠时长：6.5小时
过去7天平均：7.2小时
参考范围：7-9小时（CDC建议）"

❌ BAD:
"您昨晚睡眠不足，这会影响健康。"
```

---

### 3.2 Anomaly Detection Alerts

**Context**: System detected metric outside expected range

#### ✅ DO Use

| Severity | Wording Pattern | Example |
|----------|-----------------|---------|
| Mild | "注意到变化" | "注意到您的静息心率较上周有所上升" |
| Moderate | "建议关注" | "您的静息心率持续高于通常范围，建议关注" |
| Attention | "建议咨询" | "该指标变化较明显，建议咨询专业医疗机构确认" |

#### ❌ DO NOT Use

| Severity | Prohibited | Why |
|----------|------------|-----|
| Any | "异常" | Clinical term |
| Any | "有问题" | Diagnostic implication |
| Any | "需要治疗" | Treatment advice |
| Any | "可能是XX病" | Differential diagnosis |

#### Severity-Specific Examples

**MILD (Population variance)**
```
✅ GOOD:
"您的BMI为26.5，根据WHO分类属于'超重'范围。
这只是基于体重的初步参考，体型和肌肉量也会影响健康评估。"

❌ BAD:
"您已超重，需要减肥。"
```

**MODERATE (Personal baseline deviation)**
```
✅ GOOD:
"您的静息心率（85bpm）较您的个人基线（68bpm）有所上升。
可能的原因包括：近期压力、睡眠质量变化、或轻度脱水。
如持续一周以上，建议咨询医生。"

❌ BAD:
"您的心率异常，可能是心脏问题，建议检查。"
```

**REQUIRES ATTENTION (Significant deviation)**
```
✅ GOOD:
"您的静息心率连续5天超过100bpm，这明显高于一般成人范围（60-100bpm）。
建议您尽快咨询医疗机构，以排除需要关注的情况。
⚠️ 本平台仅为经验交流，不能替代专业诊断。"

❌ BAD:
"您患有心动过速，需要立即治疗。"
```

---

### 3.3 A2A Consultation Prompts

**Context**: System prompt sent to other agents with metric context

#### ✅ DO Use

| Element | Pattern | Example |
|---------|---------|---------|
| Context introduction | "用户分享了以下健康数据" | "用户分享了最近7天的睡眠记录" |
| Metric presentation | "数值为X，趋势为Y" | "平均睡眠时长6小时，趋势下降" |
| Question framing | "您是否有过类似经历" | "您是否也有过睡眠时长变化的经历？" |
| Guidance request | "您有什么经验可以分享" | "关于改善睡眠习惯，您有什么经验可以分享？" |

#### ❌ DO NOT Use

| Element | Prohibited | Why |
|---------|------------|-----|
| Diagnosis request | "这是什么问题" | Requests diagnostic interpretation |
| Treatment request | "应该怎么办" | Requests treatment advice |
| Opinion on condition | "这严重吗" | Requests clinical judgment |

#### Full Prompt Example

```
✅ GOOD SYSTEM PROMPT:
"用户希望咨询关于个人健康数据的经验。

用户分享的数据：
- 最近7天平均睡眠时长：6小时
- 用户个人基线：7.5小时
- 变化：较基线减少1.5小时

用户没有提及任何症状或医疗诊断。

问题：您是否有过睡眠时长突然减少的经历？
如果有，您是如何调整的？
请基于您的个人经验分享，不要提供医疗建议。"

❌ BAD SYSTEM PROMPT:
"用户睡眠只有6小时，这是失眠吗？
用户应该怎么治疗？请给出建议。"
```

---

### 3.4 Report Summaries

**Context**: Report consensus and divergence points

#### ✅ DO Use

| Report Element | Safe Pattern | Example |
|----------------|--------------|---------|
| Consensus | "X位Agent认同" + "经验分享" | "3/5位Agent认同：建立固定作息有助于改善睡眠" |
| Divergence | "不同经验" + "个人差异" | "有Agent建议睡前冥想，也有Agent建议减少咖啡因——效果因人而异" |
| Preparation | "实用建议" | "准备事项：记录一周睡眠日记" |
| Doctor confirm | "需专业确认" | "睡眠持续时间变化是否需要就医，建议咨询医生判断" |

#### ❌ DO NOT Use

| Report Element | Prohibited | Why |
|----------------|------------|-----|
| Consensus | "医学共识是" | Impersonates medical authority |
| Divergence | "正确做法是" | Prescriptive judgment |
| Preparation | "治疗方案包括" | Treatment language |
| Doctor confirm | "您必须看医生" | Absolute requirement |

#### Report Section Examples

**CONSENSUS SECTION**
```
✅ GOOD:
┌─────────────────────────────────────────┐
│ 共识观点（基于3位Agent的经验分享）       │
├─────────────────────────────────────────┤
│ • 建立固定的睡前仪式（如阅读、冥想）     │
│   有助于向身体发送睡眠信号               │
│                                         │
│ • 避免睡前2小时使用电子屏幕              │
│   多位Agent认为这是影响睡眠的常见因素     │
└─────────────────────────────────────────┘

❌ BAD:
┌─────────────────────────────────────────┐
│ 医学共识                               │
├─────────────────────────────────────────┤
│ • 您需要建立睡眠卫生                    │
│ • 蓝光会抑制褪黑素，必须避免            │
└─────────────────────────────────────────┘
```

**PREPARATION SECTION**
```
✅ GOOD:
┌─────────────────────────────────────────┐
│ 就医准备清单                            │
├─────────────────────────────────────────┤
│ 如果您决定咨询医生，以下准备可能有帮助：  │
│                                         │
│ □ 记录近2周的睡眠日记（入睡时间、        │
│   醒来时间、夜间觉醒次数）               │
│ □ 记录可能的诱因（压力事件、饮食变化）   │
│ □ 带上您使用的任何助眠产品的包装         │
└─────────────────────────────────────────┘

❌ BAD:
┌─────────────────────────────────────────┐
│ 治疗方案                               │
├─────────────────────────────────────────┤
│ 1. 必须做睡眠监测                       │
│ 2. 考虑使用褪黑素补充剂                 │
│ 3. 推荐认知行为疗法                     │
└─────────────────────────────────────────┘
```

---

### 3.5 Weekly Summaries

**Context**: Automated weekly health data summary

#### ✅ DO Use

| Element | Pattern | Example |
|---------|---------|---------|
| Trend description | "较上周X%" | "本周平均睡眠时长7.2小时，较上周提升5%" |
| Milestone | "连续记录X天" | "恭喜您连续记录睡眠14天！" |
| Suggestion | "您可以考虑" | "您可以考虑保持当前的入睡时间一致性" |
| Context | "一般建议" | "一般建议成年人每周进行150分钟中等强度活动" |

#### ❌ DO NOT Use

| Element | Prohibited | Why |
|---------|------------|-----|
| Health judgment | "您的健康状况" | Implies clinical assessment |
| Prescription | "您需要" | Prescriptive |
| Diagnosis | "改善明显" without context | Can imply disease recovery |

#### Full Weekly Summary Example

```
✅ GOOD:
┌─────────────────────────────────────────┐
│ 您的本周健康数据摘要                    │
│ 2025年2月3日 - 2月9日                   │
├─────────────────────────────────────────┤
│ 睡眠                                    │
│ • 平均时长：7.2小时/天                  │
│ • 较上周：+5%（+0.3小时）               │
│ • 入睡时间一致性：良好（±15分钟）        │
│                                         │
│ 心率                                    │
│ • 平均静息心率：72bpm                   │
│ • 较上周：-2bpm                         │
│ • 您的个人基线范围：68-75bpm            │
│                                         │
│ 🎉 里程碑                               │
│ 连续记录14天达成！                      │
│                                         │
│ 温馨提示                                │
│ 保持规律的作息时间是改善睡眠质量        │
│ 的重要因素之一。其他用户的经验表明，     │
│ 固定的睡前仪式可能有帮助。              │
│                                         │
│ ⚠️ 本摘要仅供参考，不构成医疗建议。     │
└─────────────────────────────────────────┘

❌ BAD:
┌─────────────────────────────────────────┐
│ 您的健康报告                            │
├─────────────────────────────────────────┤
│ 睡眠：恢复正常                          │
│ 心率：已改善                            │
│                                         │
│ 建议：继续保持，您的健康状况良好。      │
└─────────────────────────────────────────┘
```

---

### 3.6 Push Notifications

**Context**: Mobile/app push notifications for health data

#### ✅ DO Use

| Type | Pattern | Example |
|------|---------|---------|
| Reminder | "别忘了" | "别忘了记录今天的健康数据" |
| Milestone | "达成" | "🎉 连续记录7天达成！" |
| Trend | "注意到" | "MedCrowd：注意到您的睡眠时长有变化" |
| Anomaly | "建议查看" | "您的静息心率数据有更新，建议查看详情" |

#### ❌ DO NOT Use

| Type | Prohibited | Why |
|------|------------|-----|
| Any | "警告" "警报" | Alarmist |
| Any | "异常检测到" | Diagnostic |
| Any | "健康问题" | Clinical implication |

#### Notification Examples

```
✅ GOOD:
标题：睡眠数据更新
内容：您本周的睡眠趋势已生成，点击查看详情。

标题：记录提醒
内容：今天还没记录健康数据哦，花30秒记录一下吧。

❌ BAD:
标题：健康警报！
内容：检测到心率异常，请立即查看。
```

---

### 3.7 Error Messages

**Context**: Validation errors, input errors

#### ✅ DO Use

| Error Type | Pattern | Example |
|------------|---------|---------|
| Invalid value | "请输入有效数值" | "请输入有效的体重数值（20-300kg）" |
| Extreme value | "请确认数值正确" | "您输入的心率为150bpm，请确认是否正确" |
| Out of scope | "暂不支持" | "该指标类型暂不支持，V1支持体重、睡眠、心率" |
| Technical | "请稍后再试" | "数据保存失败，请稍后再试" |

#### ❌ DO NOT Use

| Error Type | Prohibited | Why |
|------------|------------|-----|
| Any | "危险" "危急" | Alarmist |
| Any | "需要就医" | Inappropriate for input error |

---

## 4. Verification Checklist

### 4.1 Before Publishing Any Copy

Use this checklist for every piece of health data-related content:

- [ ] Does it contain "诊断" "治疗" "患有" "病症"? → REWRITE
- [ ] Does it claim to know the user's health status? → REWRITE
- [ ] Does it prescribe specific actions? → SOFTEN to suggestions
- [ ] Does it use "正常" "异常" without context? → ADD context
- [ ] Does it create urgency without cause? → REDUCE alarm
- [ ] Is the disclaimer present and visible? → ADD if missing
- [ ] Does it encourage professional consultation appropriately? → ADD if missing

### 4.2 Quick Safety Test

Ask these questions about your copy:

1. **Could this be interpreted as a diagnosis?**
   - If yes → Rewrite with descriptive language only

2. **Does this tell the user what to do about their health?**
   - If yes → Change to "you might consider" or "some people find"

3. **Would I say this to a stranger at a party?**
   - If no → Too clinical/personal; soften

4. **Does this replace a doctor's role?**
   - If yes → Add "consult a professional" disclaimer

5. **Is there any way this could cause harm if misunderstood?**
   - If yes → Add clarifying context

---

## 5. Copy Templates

### 5.1 Metric Interpretation Templates

```
TEMPLATE: Single Metric Review
─────────────────────────────
已记录您的[METRIC_NAME]：[VALUE][UNIT]

[IF BASELINE EXISTS]
较您的个人基线[BASELINE]：[CHANGE]

[IF POPULATION REFERENCE EXISTS]
参考范围：[RANGE]（[SOURCE]）

[NEUTRAL CONTEXT]
[Metric-specific educational sentence, e.g., "静息心率因人而异，受多种因素影响。"]

[DISCLAIMER]
以上仅为数据记录，不构成健康评估。
```

```
TEMPLATE: Trend Summary
─────────────────────────────
过去[PERIOD]的[METRIC_NAME]趋势：

平均：[AVERAGE][UNIT]
变化：较上[PERIOD] [CHANGE]
一致性：[VARIANCE_DESCRIPTION]

[IF MILESTONE]
🎉 [MILESTONE_CELEBRATION]

[OPTIONAL GENERAL TIP]
[General wellness tip related to metric, e.g., "保持规律作息有助于睡眠质量。"]

⚠️ 本摘要仅供参考。
```

### 5.2 Consultation Context Templates

```
TEMPLATE: Consultation with Metric Context
─────────────────────────────
用户正在咨询关于个人健康数据的经验。

用户分享的信息：
- 指标：[METRIC_NAME]
- 数据：[DATA_DESCRIPTION]
- 观察：[NEUTRAL_OBSERVATION]

用户没有提及任何症状、诊断或正在服用的药物。

问题：[USER_QUESTION]

请基于您的个人经验分享，不要提供医疗建议或诊断。
```

---

## 6. Quick Reference: Word Substitutions

| Instead of | Use | Context |
|------------|-----|---------|
| 正常 | 在参考范围内 | Metric review |
| 异常 | 偏离[基线/范围] | Anomaly detection |
| 超标 | 高于参考值 | BMI/weight |
| 不足 | 少于建议时长 | Sleep |
| 过快/过慢 | 高于/低于典型范围 | Heart rate |
| 患有 | 数据显示 | Any metric |
| 需要治疗 | 建议咨询专业人士 | Any concern |
| 危险 | 值得关注 | Moderate anomaly |
| 必须 | 建议考虑 | Recommendations |
| 肯定 | 可能 | Uncertainties |

---

## 7. References

### 7.1 Implementation Files

| Component | File Path |
|-----------|-----------|
| Safety check | `web/src/lib/safety.ts` |
| Report generation | `web/src/lib/summary/pipeline.ts` |
| Report types | `web/src/lib/summary/types.ts` |
| Consultation engine | `web/src/lib/engine.ts` |

### 7.2 Related Policy Docs

| Document | Content |
|----------|---------|
| `v1-health-data-policy.md` | Full policy including metric scope and Detect->Consult->Track model |
| `v1-scope-in-out.md` | Detailed IN/OUT scope boundaries |

---

## 8. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-02-11 | Initial safety wording guidelines |
