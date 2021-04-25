import { PassThrough } from "stream";

class InMemoryDuplex extends PassThrough {
  public constructor(queueSize: number) {
    super({
      objectMode: true,
      highWaterMark: queueSize,
      autoDestroy: false,
      emitClose: false,
    });
    // this.setMaxListeners(Math.pow(2, 32) / 2 - 1);
  }
}

export { InMemoryDuplex };
