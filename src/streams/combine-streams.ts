import { PassThrough, Duplex } from "stream";

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
  // passThrough.setMaxListeners(Math.pow(2, 32) / 2 - 1);
  streams.forEach((stream) => {
    passThrough = stream.pipe(passThrough);
  });
  return passThrough;
}

export { combineStreams };
