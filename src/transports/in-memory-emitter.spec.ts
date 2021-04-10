import "reflect-metadata";
import { InMemoryEmitter } from "./in-memory-emitter";
import { InMemoryDuplex } from "../streams/in-memory-duplex";

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
      emitter.once({ event: "test" }, () => {});
      let streams = Reflect.getOwnPropertyDescriptor(emitter, "streams");
      expect(streams?.value).toBeInstanceOf(Map);
      expect(streams?.value.size).toEqual(1);
      expect(streams?.value.get("test")).toBeInstanceOf(InMemoryDuplex);
      emitter.once({ event: "test" }, () => {});
      expect(streams?.value.size).toEqual(1);
    });
    it("should return immediately the read value at first, if one present in wrapped stream", async () => {
      const emitter = new InMemoryEmitter(10);
      await emitter.emit({ event: "test" }, {});
      const streams = Reflect.getOwnPropertyDescriptor(emitter, "streams");
      const testStream = streams?.value.get("test");
      const spyRead = jest.spyOn(testStream, "read");
      emitter.once({ event: "test" }, (data) => {
        expect(data).toEqual({});
        expect(spyRead).toHaveBeenCalledTimes(1);
      });
    });
    it("should  read a value at first, then wait for one present in wrapped stream", async () => {
      const emitter = new InMemoryEmitter(10);
      emitter.once({ event: "test" }, (data) => {
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
      const res = await emitter.once({ event: "test" }, (data) => {});
      expect(res).toBeUndefined();
    });
  });
  describe("emit", () => {
    it("", async () => {});
  });
});
