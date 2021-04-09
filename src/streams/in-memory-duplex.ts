import { Transform, PassThrough } from "stream";

class InMemoryDuplex extends PassThrough {
  public constructor(queueSize: number) {
    super({
      objectMode: true,
      highWaterMark: queueSize,
      autoDestroy: false,
      allowHalfOpen: true,
      emitClose: false,
      // transform: (chunck) => {
      //   this.write(chunck);
      // },
    });
  }
}

export { InMemoryDuplex };
