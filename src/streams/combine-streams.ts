import { PassThrough, Duplex, Readable } from "stream";

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
