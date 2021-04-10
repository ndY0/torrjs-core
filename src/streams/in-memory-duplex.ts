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
}

export { InMemoryDuplex };
