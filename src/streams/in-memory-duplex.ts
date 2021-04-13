import { PassThrough } from "stream";

class InMemoryDuplex extends PassThrough {
  public constructor(queueSize: number) {
    super({
      objectMode: true,
      highWaterMark: queueSize,
      autoDestroy: false,
      emitClose: false,
    });
  }
  //necessary : if concurrent clients await for publication of event, they need authorization one after one
  public emit(event: string, ...data: any[]): boolean {
    const listeners = this.listeners(event);
    if (listeners.length !== 0) {
      const listener = <(...args: any[]) => void>listeners.shift();
      listener(...data);
      this.removeListener(event, listener);
      return true;
    } else {
      return false;
    }
  }
}

export { InMemoryDuplex };
