import { InMemoryDuplex } from "./in-memory-duplex";

describe("InMemoryDuplex", () => {
  it(`should create a passthrough duplex stream, in object mode, no autodestroy,
    no auto emit close, with a high watermark of the given constructor size`, () => {
    const passthrough = new InMemoryDuplex(10);
    expect(passthrough.readableObjectMode).toBeTruthy();
    expect(passthrough.writableObjectMode).toBeTruthy();
    expect(passthrough.destroyed).toBeFalsy();
    expect(passthrough.readableHighWaterMark).toEqual(10);
    expect(passthrough.writableHighWaterMark).toEqual(10);
  });
});
