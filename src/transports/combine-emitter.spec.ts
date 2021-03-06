import "reflect-metadata";
import { InMemoryDuplex } from "../streams/in-memory-duplex";
import { delay, memo, putMemoValue } from "../utils";
import { CombineEmitter } from "./combine-emitter";
import { PassThrough } from "stream";

describe("CombineEmitter", () => {
  describe("constructor", () => {
    it("should all provided streams into one output stream", async () => {
      const stream1 = new InMemoryDuplex(10);
      const stream2 = new InMemoryDuplex(10);
      const emitter = new CombineEmitter([stream1, stream2]);
      const stream = Reflect.getOwnPropertyDescriptor(emitter, "stream");
      expect(stream?.value).toBeInstanceOf(PassThrough);
    });
  });
  describe("once", () => {
    it("should return immediately the read value at first, if one present in wrapped stream", async () => {
      const stream1 = new InMemoryDuplex(10);
      const stream2 = new InMemoryDuplex(10);
      const emitter = new CombineEmitter([stream1, stream2]);
      const canceler = memo(true);
      stream1.write([{ event: "test" }]);
      const stream = Reflect.getOwnPropertyDescriptor(emitter, "stream");
      const testStream = stream?.value;
      const spyRead = jest.spyOn(testStream, "read");
      emitter.once({ event: "test", canceler }, (data) => {
        expect(data).toEqual({ event: "test" });
        expect(spyRead).toHaveBeenCalledTimes(1);
      });
    });
    it("should  read a value at first, then wait for one present in wrapped stream", async () => {
      const stream1 = new InMemoryDuplex(10);
      const stream2 = new InMemoryDuplex(10);
      const emitter = new CombineEmitter([stream1, stream2]);
      const canceler = memo(true);
      emitter.once({ event: "test", canceler }, (data) => {
        expect(data).toEqual({ event: "test" });
        expect(spyRead).toHaveBeenCalledTimes(2);
      });
      const stream = Reflect.getOwnPropertyDescriptor(emitter, "stream");
      const testStream = stream?.value;
      const spyRead = jest.spyOn(testStream, "read");
      stream2.write([{ event: "test" }]);
      // avoid immediat return and let handler execute properly
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 1000));
    });
    it("should await for data for 10 second before returning undefined", async () => {
      const stream1 = new InMemoryDuplex(10);
      const stream2 = new InMemoryDuplex(10);
      const emitter = new CombineEmitter([stream1, stream2]);
      const canceler = memo(true);
      const res = await emitter.once({ event: "test", canceler }, (data) => {});
      expect(res).toBeUndefined();
    });
    it("should await for data before timeout before returning undefined, and skip reading from inner stream", async () => {
      const stream1 = new InMemoryDuplex(10);
      const stream2 = new InMemoryDuplex(10);
      const emitter = new CombineEmitter([stream1, stream2]);
      const canceler = memo(true);
      const stream = Reflect.getOwnPropertyDescriptor(emitter, "stream");
      const res = await emitter.once({ event: "test", canceler }, (data) => {});
      const testStream = stream?.value;
      const spyRead = jest.spyOn(testStream, "read");
      stream1.write([{ event: "test" }]);
      await new Promise<void>((resolve) =>
        setTimeout(() => {
          expect(spyRead).toHaveBeenCalledTimes(1);
          resolve();
        }, 200)
      );
      expect(res).toBeUndefined();
    });
    it("should avoid reading from inner stream if cancellation event is triggered", async () => {
      const stream1 = new InMemoryDuplex(10);
      const stream2 = new InMemoryDuplex(10);
      const emitter = new CombineEmitter([stream1, stream2]);
      const canceler = memo(true);
      const stream = Reflect.getOwnPropertyDescriptor(emitter, "stream");
      const res = await Promise.all([
        emitter.once({ event: "test", canceler }, (data) => {}),
        (async () => {
          const testStream = stream?.value;
          const spyRead = jest.spyOn(testStream, "read");
          putMemoValue(canceler, false);
          stream2.write([{ event: "test" }]);
          await new Promise<void>((resolve) =>
            setTimeout(() => {
              expect(spyRead).toHaveBeenCalledTimes(1);
              resolve();
            }, 200)
          );
        })(),
      ]);
      expect(res[0]).toBeUndefined();
    });
  });
  describe("emit", () => {
    it("should throw an error if tryong to emit from it", async () => {
      const stream1 = new InMemoryDuplex(10);
      const stream2 = new InMemoryDuplex(10);
      const emitter = new CombineEmitter([stream1, stream2]);
      await emitter.emit({}).catch((e: Error) => {
        expect(e).toEqual(
          new Error("this merged readable shouldn't be emitting")
        );
      });
    });
  });
  describe("getInternalStreamType", () => {
    it("should return the class object of the used internal stream", () => {
      const stream1 = new InMemoryDuplex(10);
      const stream2 = new InMemoryDuplex(10);
      const emitter = new CombineEmitter([stream1, stream2]);
      expect(emitter.getInternalStreamType()).toEqual(PassThrough);
    });
  });
  describe("setStream", () => {
    it("should set a duplex stream for the given key", () => {
      const stream1 = new InMemoryDuplex(10);
      const stream2 = new InMemoryDuplex(10);
      const emitter = new CombineEmitter([stream1, stream2]);
      emitter.setStream("", new (emitter.getInternalStreamType())());
      const streamsDescriptor = Reflect.getOwnPropertyDescriptor(
        emitter,
        "stream"
      );

      expect(streamsDescriptor?.value).toBeInstanceOf(PassThrough);
    });
  });
  describe("getStream", () => {
    it("should get a duplex stream for the given key", () => {
      const stream1 = new InMemoryDuplex(10);
      const stream2 = new InMemoryDuplex(10);
      const emitter = new CombineEmitter([stream1, stream2]);
      emitter.setStream("test", new (emitter.getInternalStreamType())());
      const stream = emitter.getStream("test");
      expect(stream).toBeInstanceOf(PassThrough);
    });
  });
  describe("resetInternalStreams", () => {
    it("should throw an error if this implementation is called", () => {
      const stream1 = new InMemoryDuplex(10);
      const stream2 = new InMemoryDuplex(10);
      const emitter = new CombineEmitter([stream1, stream2]);
      expect(() => emitter.resetInternalStreams()).toThrow(
        new Error("this stream shouldn't be reseted")
      );
    });
  });
});
