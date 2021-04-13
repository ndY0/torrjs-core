import "reflect-metadata";
import { InMemoryEmitter } from "./in-memory-emitter";
import { InMemoryDuplex } from "../streams/in-memory-duplex";
import { delay, memo } from "../utils";
import { emit } from "process";

describe("InMemoryEmitter", () => {
  describe("constructor", () => {
    it("should set an an empty map in streams property", async () => {
      const emitter = new InMemoryEmitter(10);
      const streams = Reflect.getOwnPropertyDescriptor(emitter, "streams");
      expect(streams?.value).toBeInstanceOf(Map);
      expect(streams?.value.size).toEqual(0);
    });
  });
  describe("once", () => {
    it("should create a InMemory stream for the given event name if none is present, or reuse one if existing", async () => {
      const emitter = new InMemoryEmitter(10);
      const canceler = memo(true);
      emitter.once({ event: "test", canceler }, () => {});
      let streams = Reflect.getOwnPropertyDescriptor(emitter, "streams");
      expect(streams?.value).toBeInstanceOf(Map);
      expect(streams?.value.size).toEqual(1);
      expect(streams?.value.get("test")).toBeInstanceOf(InMemoryDuplex);
      emitter.once({ event: "test", canceler }, () => {});
      expect(streams?.value.size).toEqual(1);
    });
    it("should return immediately the read value at first, if one present in wrapped stream", async () => {
      const emitter = new InMemoryEmitter(10);
      const canceler = memo(true);
      await emitter.emit({ event: "test" }, {});
      const streams = Reflect.getOwnPropertyDescriptor(emitter, "streams");
      const testStream = streams?.value.get("test");
      const spyRead = jest.spyOn(testStream, "read");
      emitter.once({ event: "test", canceler }, (data) => {
        expect(data).toEqual({});
        expect(spyRead).toHaveBeenCalledTimes(1);
      });
    });
    it("should  read a value at first, then wait for one present in wrapped stream", async () => {
      const emitter = new InMemoryEmitter(10);
      const canceler = memo(true);
      emitter.once({ event: "test", canceler }, (data) => {
        expect(data).toEqual({});
        expect(spyRead).toHaveBeenCalledTimes(2);
      });
      const streams = Reflect.getOwnPropertyDescriptor(emitter, "streams");
      const testStream = streams?.value.get("test");
      const spyRead = jest.spyOn(testStream, "read");
      await emitter.emit({ event: "test" }, {});
      // avoid immediat return and let handler execute properly
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 1000));
    });
    it("should await for data for 10 second before returning undefined", async () => {
      const emitter = new InMemoryEmitter(10);
      const canceler = memo(true);
      const res = await emitter.once({ event: "test", canceler }, (data) => {});
      expect(res).toBeUndefined();
    });
    it("should await for data before timeout before returning undefined, and skip reading from inner stream", async () => {
      const emitter = new InMemoryEmitter(10);
      const canceler = memo(true);
      const streams = Reflect.getOwnPropertyDescriptor(emitter, "streams");
      const res = await emitter.once({ event: "test", canceler }, (data) => {});
      const testStream = streams?.value.get("test");
      const spyRead = jest.spyOn(testStream, "read");
      await emitter.emit({ event: "test" }, {});
      await new Promise<void>((resolve) =>
        setTimeout(() => {
          expect(spyRead).toHaveBeenCalledTimes(1);
          resolve();
        }, 200)
      );
      expect(res).toBeUndefined();
    });
  });
  describe("emit", () => {
    it("should create a InMemory stream for the given event name if none is present, or reuse one if existing", async () => {
      const emitter = new InMemoryEmitter(10);
      const canceler = memo(true);
      emitter.once({ event: "test", canceler }, () => {});
      let streams = Reflect.getOwnPropertyDescriptor(emitter, "streams");
      expect(streams?.value).toBeInstanceOf(Map);
      expect(streams?.value.size).toEqual(1);
      expect(streams?.value.get("test")).toBeInstanceOf(InMemoryDuplex);
      emitter.emit({ event: "test" }, {});
      expect(streams?.value.size).toEqual(1);
    });
    it("should write to inner stream and return immediately if operation successfull", async () => {
      const emitter = new InMemoryEmitter(10);
      const canceler = memo(true);
      await emitter.once({ event: "test", canceler }, () => {});
      const streams = Reflect.getOwnPropertyDescriptor(emitter, "streams");
      const testStream = streams?.value.get("test");
      const spyWrite = jest.spyOn(testStream, "write");
      await emitter.emit({ event: "test" });
      expect(spyWrite).toHaveBeenCalledTimes(1);
    });
    it("should write to inner stream and wait until inner stream drains before rewritting", async () => {
      // testing with a queue of size one introduce error, since the queue size account for readable and writable stream sizes
      const emitter = new InMemoryEmitter(2);
      const canceler = memo(true);
      await emitter.emit({ event: "test" });
      await emitter.emit({ event: "test" });
      const streams = Reflect.getOwnPropertyDescriptor(emitter, "streams");
      const testStream = streams?.value.get("test");
      const spyWrite = jest.spyOn(testStream, "write");
      await Promise.all([
        emitter.emit({ event: "test" }),
        (async () => {
          await delay(200);
          await emitter.once({ event: "test", canceler }, () => {});
          await emitter.once({ event: "test", canceler }, () => {});
        })(),
      ]);
      expect(spyWrite).toHaveBeenCalledTimes(2);
    });
    it("should try to write to inner stream and return if default 5_000 timeout is reached, yet writting if possible", async () => {
      const emitter = new InMemoryEmitter(2);
      const canceler = memo(true);
      await emitter.emit({ event: "test" });
      await emitter.emit({ event: "test" });
      const streams = Reflect.getOwnPropertyDescriptor(emitter, "streams");
      const testStream = streams?.value.get("test");
      const spyWrite = jest.spyOn(testStream, "write");
      await Promise.all([
        emitter.emit({ event: "test" }),
        (async () => {
          await delay(200);
          await emitter.once({ event: "test", canceler }, () => {});
        })(),
      ]);
      expect(spyWrite).toHaveBeenCalledTimes(1);
      await emitter.once({ event: "test", canceler }, () => {});
      await delay(200);
      expect(spyWrite).toHaveBeenCalledTimes(2);
    });
    it("should try to write to inner stream and return if provided timeout is reached, yet writting if possible", async () => {
      const emitter = new InMemoryEmitter(2);
      const canceler = memo(true);
      await emitter.emit({ event: "test" });
      await emitter.emit({ event: "test" });
      const streams = Reflect.getOwnPropertyDescriptor(emitter, "streams");
      const testStream = streams?.value.get("test");
      const spyWrite = jest.spyOn(testStream, "write");
      await Promise.all([
        emitter.emit({ event: "test", timeout: 200 }),
        (async () => {
          await delay(200);
          await emitter.once({ event: "test", canceler }, () => {});
        })(),
      ]);
      expect(spyWrite).toHaveBeenCalledTimes(1);
      await emitter.once({ event: "test", canceler }, () => {});
      await delay(200);
      expect(spyWrite).toHaveBeenCalledTimes(2);
    });
  });
});
