import { PassThrough, Duplex, Readable } from "stream";

// class MultiplexReadable extends PassThrough {
//   private transformStream: Duplex | undefined;
//   public constructor(queueSize: number, private streams: Duplex[]) {
//     super({
//       objectMode: true,
//       highWaterMark: queueSize,
//       autoDestroy: false,
//       emitClose: false,
//     });
//     (<any>destination).unpipe(this);
//     this.streams.forEach((stream) => {
//       destination = (<any>destination).pipe(stream);
//     });
//     this.transformStream = <any>destination;
// this.on("pipe", (source: Duplex) => {
//   source.unpipe(this);
//   this.streams.forEach((stream) => {
//     source = source.pipe(stream);
//   });
//   this.transformStream = source;
// });
//   }
//   pipe<T extends NodeJS.WritableStream>(
//     destination: T,
//     options?: { end?: boolean }
//   ): T {
//     return <T>this.transformStream?.pipe(destination, options);
//   }
// }

function combineStreams(streams: Duplex[]): Duplex {
  const queueSize = streams.reduce(
    (acc, stream) => acc + stream.writableHighWaterMark,
    0
  );
  let passThrough = new PassThrough({
    objectMode: true,
    highWaterMark: queueSize,
    autoDestroy: false,
    emitClose: false,
  });
  streams.forEach((stream) => {
    passThrough = stream.pipe(passThrough);
  });
  return passThrough;
}

export { combineStreams };
