import { GenRegistry } from "./genregistry";
import { InMemoryEmitter } from "../transports/in-memory-emitter";
import { Server } from "../annotations/server";
import { memo, getMemoPromise, delay, putMemoValue } from "../utils";
import { GenServer } from "./genserver";
import EventEmitter from "events";
import { ChildSpec, ChildRestartStrategy } from "../supervision/types";
import { keyForIdSymbol } from "../utils/symbols";

class DelayNormalPermanentServer extends GenServer {
  protected async *init(
    ...args: unknown[]
  ): AsyncGenerator<unknown, any, unknown> {
    return null;
  }
  public async *start<U extends typeof GenServer>(
    startArgs: any,
    context: U,
    canceler: AsyncGenerator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>
  ) {
    await delay(200);
  }
  public async *childSpec(): AsyncGenerator<void, ChildSpec, unknown> {
    return {
      restart: ChildRestartStrategy.PERMANENT,
      shutdown: 10_000,
    };
  }
}

@Server(new InMemoryEmitter(10), { test: new InMemoryEmitter(10) })
class TestGenRegistry extends GenRegistry {}

describe("GenRegistry", () => {
  describe("start", () => {
    it("should call init which returns an empty map, then call run once and wait for a message, stopping on canceler resolution", async () => {
      const registry = new TestGenRegistry();
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const initSpy = jest.spyOn(registry, "init");
      const runSpy = jest.spyOn(registry, "run");
      const res = await Promise.all([
        registry.start({}, TestGenRegistry, canceler, cancelerPromise).next(),
        (async () => {
          await delay(200);
          expect(initSpy).toHaveBeenCalledTimes(1);
          expect(runSpy).toHaveBeenCalledTimes(1);
          putMemoValue(canceler, false);
        })(),
      ]);
      expect(res[0].done).toBeTruthy();
    });
  });
  describe("register", () => {
    it("should allow to create a registration of an id, creating the registration key if it doesn't exist, adding to it if it already exists", async () => {
      const registry = new TestGenRegistry();
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const runSpy = jest.spyOn(registry, "run");
      const server = new DelayNormalPermanentServer();
      const res = await Promise.all([
        registry.start({}, TestGenRegistry, canceler, cancelerPromise).next(),
        (async () => {
          await delay(200);
          expect(runSpy).toHaveBeenNthCalledWith(
            1,
            canceler,
            cancelerPromise,
            TestGenRegistry,
            new Map()
          );
          await GenRegistry.register(
            [TestGenRegistry],
            "myCustomKey",
            server[keyForIdSymbol]
          ).next();
          await delay(200);
          const secondeCallArg = new Map();
          secondeCallArg.set("myCustomKey", [server[keyForIdSymbol]]);
          expect(runSpy).toHaveBeenNthCalledWith(
            2,
            canceler,
            cancelerPromise,
            TestGenRegistry,
            secondeCallArg
          );
          await GenRegistry.register(
            [TestGenRegistry, "test"],
            "myCustomKey",
            server[keyForIdSymbol]
          ).next();
          await delay(200);
          const thirdCallArg = new Map();
          secondeCallArg.set("myCustomKey", [
            server[keyForIdSymbol],
            server[keyForIdSymbol],
          ]);
          expect(runSpy).toHaveBeenNthCalledWith(
            3,
            canceler,
            cancelerPromise,
            TestGenRegistry,
            secondeCallArg
          );
          putMemoValue(canceler, false);
        })(),
      ]);
      expect(res[0].done).toBeTruthy();
    });
  });
  describe("lookup", () => {
    it("should allow to fetch registration of an id, giving back the registered array if it doesn't exist, return an empty array", async () => {
      const registry = new TestGenRegistry();
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const server = new DelayNormalPermanentServer();
      const res = await Promise.all([
        registry.start({}, TestGenRegistry, canceler, cancelerPromise).next(),
        (async () => {
          await delay(200);
          await GenRegistry.register(
            [TestGenRegistry],
            "myCustomKey",
            server[keyForIdSymbol]
          ).next();
          await delay(200);
          await GenRegistry.register(
            [TestGenRegistry, "test"],
            "myCustomKey",
            server[keyForIdSymbol]
          ).next();
          await delay(200);
          const data = await GenRegistry.lookup(
            [TestGenRegistry],
            server,
            "myCustomKey",
            5_000
          ).next();
          expect(data.value).toEqual([
            server[keyForIdSymbol],
            server[keyForIdSymbol],
          ]);
          const dataExternal = await GenRegistry.lookup(
            [TestGenRegistry, "test"],
            server,
            "myCustomKey",
            5_000
          ).next();
          expect(dataExternal.value).toEqual([
            server[keyForIdSymbol],
            server[keyForIdSymbol],
          ]);
          const dataEmpty = await GenRegistry.lookup(
            [TestGenRegistry, "test"],
            server,
            "nonExistingKey",
            5_000
          ).next();
          expect(dataEmpty.value).toEqual([]);
          putMemoValue(canceler, false);
        })(),
      ]);
      expect(res[0].done).toBeTruthy();
    });
  });
});
