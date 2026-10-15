export interface StopCounter {
    read(): number;
    write(continuations: number): void;
    readonly notes: string[];
}
export declare function openStopCounter(dir: string | null, sessionId: string): StopCounter;
