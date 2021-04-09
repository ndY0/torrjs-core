import { Duplex, Transform } from "stream";

class InMemoryDuplex extends Duplex {
  public constructor(queueSize: number) {
    super({
      objectMode: true,
      highWaterMark: queueSize,
    });
  }
}

export { InMemoryDuplex };
