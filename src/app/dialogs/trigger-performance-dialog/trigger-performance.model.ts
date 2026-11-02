/** What a Performance Monitor measurement is of. */
export type TriggerPerformanceKind = 'phrase' | 'conditions' | 'watched-phrases' | 'action' | 'draw' | 'update';

/** One measured thing, e.g. one phrase of one trigger, as a window reports it. */
export interface TriggerPerformanceEntry {
    triggerId: string;
    triggerName: string;
    predefined: boolean;
    kind: TriggerPerformanceKind;
    id: string;
    label: string;
    count: number;
    matches: number;
    totalMilliseconds: number;
    maximumMilliseconds: number;
}










/** The numbers one window (a log watcher or the overlays) reported. */
export interface TriggerPerformanceSource {
    source: string;
    entries: TriggerPerformanceEntry[];
}










/** One of Nag's processes and its CPU use. */
export interface TriggerPerformanceProcess {
    pid: number;
    label: string;
    type: string;
    currentPercent: number;
    averagePercent: number | null;
    memoryMegabytes: number;
}










/** The Chromium trace recording. */
export interface TriggerPerformanceTrace {
    recording: boolean;
    elapsedSeconds: number;
    durationSeconds: number;
    lastFilePath: string | null;
    error: string | null;
}










/** Everything the Performance Monitor window shows. */
export interface TriggerPerformanceState {
    enabled: boolean;
    elapsedSeconds: number;
    sources: TriggerPerformanceSource[];
    processes: TriggerPerformanceProcess[];
    trace: TriggerPerformanceTrace;
}










/** A trigger's numbers combined from every window, for one row of the table. */
export interface TriggerPerformanceRow {
    triggerId: string;
    name: string;
    group: 'mine' | 'built-in' | 'other';
    matchingMilliseconds: number;
    actionMilliseconds: number;
    drawingMilliseconds: number;
    totalMilliseconds: number;
    details: TriggerPerformanceEntry[];
}
