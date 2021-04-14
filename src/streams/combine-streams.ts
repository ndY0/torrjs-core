import { PassThrough, Duplex } from "stream";

class MultiplexReadable extends PassThrough {
  private transformStream: Duplex = new Duplex();
  public constructor(queueSize: number, private streams: Duplex[]) {
    super({
      objectMode: true,
      highWaterMark: queueSize,
      autoDestroy: false,
      emitClose: false,
    });

    this.on("pipe", (source: Duplex) => {
      source.unpipe(this);
      this.streams.forEach((stream) => {
        source = source.pipe(stream);
      });
      this.transformStream = source;
    });
  }
  pipe<T extends NodeJS.WritableStream>(
    destination: T,
    options?: { end?: boolean }
  ): T {
    return this.transformStream.pipe(destination, options);
  }
}

function combineStreams(streams: Duplex[]) {
  const queueSize = streams.reduce(
    (acc, stream) => acc + stream.writableHighWaterMark,
    0
  );
  return new MultiplexReadable(queueSize, streams).pipe(
    new PassThrough({
      objectMode: true,
      highWaterMark: queueSize,
      autoDestroy: false,
      emitClose: false,
    })
  );
}

export { MultiplexReadable, combineStreams };
