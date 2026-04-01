export const PUNCTUATION_ONLY_PATTERN = /^[，。！？；：,:、…—\-\s]+$/;

export const ATTRIBUTION_TOKEN_PATTERN =
  /(说道|说着|说完|说|问道|问|回答|答道|答|应道|应|回应|回道|回|喊道|喊|叫道|叫|吼道|吼|嚷道|嚷|嘀咕|嘟囔|喃喃|低声说|轻声说|低声道|轻声道|笑道|哭道|提醒|解释|告诉|补充|反问|脱口而出|承认)(?:[：:,，。\s]|$)/;

export const DISPLAY_TEXT_PATTERN =
  /(写着|写道|写有|写明|标着|标明|贴着|贴有|印着|印有|显示着|显示|注明|题着)/;

export const REPORT_READING_PATTERN =
  /(一字一句念起来|一字一句念起|照着.*念|念起.*呈报|取出.*呈报|宣读|朗读|念了.*时辰|念道)(?:[：:,，。\s]|$)/;

export const GENERIC_DAO_PATTERN = /[^，。！？；：,:]{0,12}道(?:[：:,，。\s]|$)/;

export const COLON_ATTRIBUTION_PATTERN = /[：:]\s*$/;

export const isDisplayTextCue = (value: string): boolean => {
  return value.trim().length > 0 && DISPLAY_TEXT_PATTERN.test(value);
};

export const looksLikeGenericDaoAttribution = (value: string): boolean => {
  return !isDisplayTextCue(value) && GENERIC_DAO_PATTERN.test(value.trim());
};

export const looksLikeColonAttribution = (value: string): boolean => {
  return !isDisplayTextCue(value) && COLON_ATTRIBUTION_PATTERN.test(value.trim());
};

export const hasSpeechAttributionCue = (value: string): boolean => {
  return !isDisplayTextCue(value) && ATTRIBUTION_TOKEN_PATTERN.test(value.trim());
};

export const hasReportReadingCue = (value: string): boolean => {
  return !isDisplayTextCue(value) && REPORT_READING_PATTERN.test(value.trim());
};
