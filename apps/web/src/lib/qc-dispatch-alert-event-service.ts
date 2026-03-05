// 一旦我被更新，请更新我的开头注释
// input: 告警事件服务调用
// output: 服务层能力导出
// pos: 质检派单告警事件服务
export {
  parseQcDispatchAlertEventListQuery,
  parseQcDispatchAlertEventResolvePayload,
  parseQcDispatchAlertScanQuery,
  parseQcDispatchAlertScheduleQuery,
} from "@/lib/qc-dispatch-alert-event/parsers";

export {
  listQcDispatchAlertEvents,
  resolveQcDispatchAlertEvent,
} from "@/lib/qc-dispatch-alert-event/events";

export {
  scanQcDispatchAlertsForBook,
  scanQcDispatchAlertsForBooks,
} from "@/lib/qc-dispatch-alert-event/scanner";

export type {
  DispatchAlertEventStatus,
  QcDispatchAlertEventListQuery,
  QcDispatchAlertEventResolvePayload,
  QcDispatchAlertScanQuery,
  QcDispatchAlertScanResult,
  QcDispatchAlertScheduleQuery,
} from "@/lib/qc-dispatch-alert-event/types";
