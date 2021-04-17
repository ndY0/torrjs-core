import "reflect-metadata";
import { GenServer } from "./genserver";
import { keyForIdSymbol, keyForMapSymbol } from "../utils/symbols";
import { ChildRestartStrategy } from "../supervision/types";
import { Server } from "../annotations/server";
import { InMemoryEmitter } from "../transports/in-memory-emitter";
import { ReplyTypes } from "../events/types";
import { handle } from "../annotations/handle";
import { memo, getMemoPromise, putMemoValue, delay } from "../utils";

class TestGenServer extends GenServer {
  protected async *init(
    ...args: unknown[]
  ): AsyncGenerator<unknown, any, unknown> {
    return [];
  }
}

@Server(new InMemoryEmitter(10))
class TestDecoratedGenServer extends GenServer {
  protected async *init(
    ...args: unknown[]
  ): AsyncGenerator<unknown, any, unknown> {
    return [];
  }
  @handle("testCast")
  private async *handleTestCast(state: any[], data: any) {
    const newState = [...state];
    newState.push(data);
    return { type: ReplyTypes.NO_REPLY, newState };
  }
  @handle("testCall")
  private async *handleTestCall(state: any[]) {
    const newState = [...state];
    const data = newState.pop();
    return { type: ReplyTypes.REPLY, newState, reply: data };
  }
  public static async *testCast(
    targetId: string,
    element: Record<string | number | symbol, any>
  ) {
    return yield* GenServer.cast(
      [TestDecoratedGenServer, targetId],
      "testCast",
      element
    );
  }
  public static async *testCall(targetId: string, self: GenServer) {
    return yield* GenServer.call(
      [TestDecoratedGenServer, targetId],
      self,
      "testCall"
    );
  }
}

@Server(new InMemoryEmitter(10), {
  test: new InMemoryEmitter(10),
  test2: new InMemoryEmitter(10),
})
class TestDecoratedExternalGenServer extends GenServer {
  protected async *init(
    ...args: unknown[]
  ): AsyncGenerator<unknown, any, unknown> {
    return [];
  }
  @handle("testCast")
  private async *handleTestCast(state: any[], data: any) {
    const newState = [...state];
    newState.push(data);
    return { type: ReplyTypes.NO_REPLY, newState };
  }
  @handle("testCall")
  private async *handleTestCall(state: any[]) {
    const newState = [...state];
    const data = newState.pop();
    return { type: ReplyTypes.REPLY, newState, reply: data };
  }
  public static async *testCast(
    targetId: string,
    element: Record<string | number | symbol, any>
  ) {
    return yield* GenServer.cast(
      [TestDecoratedExternalGenServer, targetId],
      "testCast",
      element
    );
  }
  public static async *testCall(targetId: string, self: GenServer) {
    return yield* GenServer.call(
      [TestDecoratedExternalGenServer, targetId],
      self,
      "testCall"
    );
  }
  public static async *testCastExternal(
    targetId: string,
    element: Record<string | number | symbol, any>
  ) {
    return yield* GenServer.cast(
      [TestDecoratedExternalGenServer, targetId, "test"],
      "testCast",
      element
    );
  }
  public static async *testCallExternal(targetId: string, self: GenServer) {
    return yield* GenServer.call(
      [TestDecoratedExternalGenServer, targetId, "test"],
      self,
      "testCall"
    );
  }
}

describe("GenServer", () => {
  it("should have a unique uuid as instance symbol property", () => {
    const testServer = new TestGenServer();
    const testId = Reflect.getOwnPropertyDescriptor(testServer, keyForIdSymbol);
    expect(testId?.value).toMatch(
      /^[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}$/
    );
  });
  it("should have a map as Class symbol property and a undefined eventEmitter class property", () => {
    const testMap = Reflect.getOwnPropertyDescriptor(
      TestGenServer,
      keyForMapSymbol
    );
    const testEventEmitter = Reflect.getOwnPropertyDescriptor(
      TestGenServer,
      "eventEmitter"
    );
    expect(testEventEmitter?.value).toBeUndefined();
  });
  it("should return the default child Specs when childSpec is not overriden", async () => {
    const testServer = new TestGenServer();
    expect((await testServer.childSpec().next())?.value).toEqual({
      restart: ChildRestartStrategy.PERMANENT,
      shutdown: 10_000,
    });
  });
  describe("start", () => {
    it("should start the server loop, and stop it when the canceler is triggered", async () => {
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const testDecoratedServer = new TestDecoratedGenServer();
      const startGenerator = testDecoratedServer.start(
        [{}],
        TestDecoratedGenServer,
        canceler,
        cancelerPromise
      );
      const res = await Promise.all([
        startGenerator.next(),
        (async () => {
          await delay(5_000);
          await putMemoValue(canceler, false);
        })(),
      ]);
      expect(res[0].value).toBeUndefined();
      expect(res[0].done).toBeTruthy();
    });
    it("should cast the event to the attached function", async () => {
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const testDecoratedServer = new TestDecoratedGenServer();
      const serverIdDescriptor = Reflect.getOwnPropertyDescriptor(
        testDecoratedServer,
        keyForIdSymbol
      );
      const serverId = serverIdDescriptor?.value;
      const spyTestCast = jest.spyOn(testDecoratedServer, "handleTestCast");
      const startGenerator = testDecoratedServer.start(
        [{}],
        TestDecoratedGenServer,
        canceler,
        cancelerPromise
      );
      const res = await Promise.all([
        startGenerator.next(),
        (async () => {
          await delay(200);
          await TestDecoratedGenServer.testCast(serverId, {
            test: "test",
          }).next();
          await delay(200);
          await putMemoValue(canceler, false);
        })(),
      ]);
      expect(spyTestCast).toHaveBeenLastCalledWith([], { test: "test" });
    });
    it("should cast the event to the attached function, and on second call, pass the previous state", async () => {
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const testDecoratedServer = new TestDecoratedGenServer();
      //   const testDecoratedClient = new TestDecoratedGenServer();
      const serverIdDescriptor = Reflect.getOwnPropertyDescriptor(
        testDecoratedServer,
        keyForIdSymbol
      );
      const serverId = serverIdDescriptor?.value;
      const spyTestCast = jest.spyOn(testDecoratedServer, "handleTestCast");
      const startGenerator = testDecoratedServer.start(
        [{}],
        TestDecoratedGenServer,
        canceler,
        cancelerPromise
      );
      const res = await Promise.all([
        startGenerator.next(),
        (async () => {
          await delay(200);
          await TestDecoratedGenServer.testCast(serverId, {
            test: "test",
          }).next();
          await TestDecoratedGenServer.testCast(serverId, {
            test: "test",
          }).next();
          await delay(200);
          await putMemoValue(canceler, false);
        })(),
      ]);
      expect(spyTestCast).toHaveBeenLastCalledWith([{ test: "test" }], {
        test: "test",
      });
    });
    it("should call the event to the attached function, and pass back the value to the caller", async () => {
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const testDecoratedServer = new TestDecoratedGenServer();
      const testDecoratedClient = new TestDecoratedGenServer();
      const serverIdDescriptor = Reflect.getOwnPropertyDescriptor(
        testDecoratedServer,
        keyForIdSymbol
      );
      const serverId = serverIdDescriptor?.value;
      const spyTestCall = jest.spyOn(testDecoratedServer, "handleTestCall");
      const startGenerator = testDecoratedServer.start(
        [{}],
        TestDecoratedGenServer,
        canceler,
        cancelerPromise
      );
      const res = await Promise.all([
        startGenerator.next(),
        (async () => {
          await delay(200);
          await TestDecoratedGenServer.testCast(serverId, {
            test: "test",
          }).next();
          await delay(200);
          const res = await TestDecoratedGenServer.testCall(
            serverId,
            testDecoratedClient
          ).next();
          await putMemoValue(canceler, false);
          await delay(200);
          return res;
        })(),
      ]);
      expect(spyTestCall).toHaveBeenLastCalledWith(
        [{ test: "test" }],
        undefined
      );
      expect(res[1].value).toEqual({ test: "test" });
    });
    it("should call the event to the attached function, and pass back the value to the caller", async () => {
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const testDecoratedServer = new TestDecoratedGenServer();
      const testDecoratedClient = new TestDecoratedGenServer();
      const serverIdDescriptor = Reflect.getOwnPropertyDescriptor(
        testDecoratedServer,
        keyForIdSymbol
      );
      const serverId = serverIdDescriptor?.value;
      const spyTestCall = jest.spyOn(testDecoratedServer, "handleTestCall");
      const startGenerator = testDecoratedServer.start(
        [{}],
        TestDecoratedGenServer,
        canceler,
        cancelerPromise
      );
      const res = await Promise.all([
        startGenerator.next(),
        (async () => {
          await delay(200);
          await TestDecoratedGenServer.testCast(serverId, {
            test: "test",
          }).next();
          await TestDecoratedGenServer.testCast(serverId, {
            test: "test",
          }).next();
          await delay(200);
          const res1 = await TestDecoratedGenServer.testCall(
            serverId,
            testDecoratedClient
          ).next();
          const res2 = await TestDecoratedGenServer.testCall(
            serverId,
            testDecoratedClient
          ).next();
          await putMemoValue(canceler, false);
          await delay(200);
          return { first: res1.value, second: res2.value };
        })(),
      ]);
      expect(spyTestCall).toHaveBeenNthCalledWith(
        1,
        [{ test: "test" }, { test: "test" }],
        undefined
      );
      expect(spyTestCall).toHaveBeenNthCalledWith(
        2,
        [{ test: "test" }],
        undefined
      );
      expect(res[1]).toEqual({
        first: { test: "test" },
        second: { test: "test" },
      });
    });
    it("shouldn't call anything if unknown event is provided, and just return the state", async () => {
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const testDecoratedServer = new TestDecoratedGenServer();
      const serverIdDescriptor = Reflect.getOwnPropertyDescriptor(
        testDecoratedServer,
        keyForIdSymbol
      );
      const serverId = serverIdDescriptor?.value;
      const spyTestCall = jest.spyOn(testDecoratedServer, "handleTestCall");
      const spyTestCast = jest.spyOn(testDecoratedServer, "handleTestCast");
      const startGenerator = testDecoratedServer.start(
        [{}],
        TestDecoratedGenServer,
        canceler,
        cancelerPromise
      );
      const res = await Promise.all([
        startGenerator.next(),
        (async () => {
          await delay(200);
          await TestDecoratedGenServer.testCast(serverId, {
            test: "test",
          }).next();
          GenServer.cast([TestDecoratedGenServer, serverId], "unknown").next();
          await TestDecoratedGenServer.testCast(serverId, {
            test: "test",
          }).next();
          await delay(200);
          await putMemoValue(canceler, false);
          await delay(200);
        })(),
      ]);
      expect(spyTestCall).not.toHaveBeenCalled();
      expect(spyTestCast).toHaveBeenCalledTimes(2);
      expect(spyTestCast).toHaveBeenNthCalledWith(2, [{ test: "test" }], {
        test: "test",
      });
    });
    it("should consume events from external sources and the internal one, when any of the listener on them resolve", async () => {
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const testDecoratedExternalServer = new TestDecoratedExternalGenServer();
      const testDecoratedClient = new TestDecoratedGenServer();
      const serverIdDescriptor = Reflect.getOwnPropertyDescriptor(
        testDecoratedExternalServer,
        keyForIdSymbol
      );
      const serverId = serverIdDescriptor?.value;
      const spyTestCall = jest.spyOn(
        testDecoratedExternalServer,
        "handleTestCall"
      );
      const startGenerator = testDecoratedExternalServer.start(
        [{}],
        TestDecoratedExternalGenServer,
        canceler,
        cancelerPromise
      );
      const res = await Promise.all([
        startGenerator.next(),
        (async () => {
          await TestDecoratedExternalGenServer.testCast(serverId, {
            test: "test",
          }).next();
          await TestDecoratedExternalGenServer.testCastExternal(serverId, {
            test: "test",
          }).next();
          const res1 = await TestDecoratedExternalGenServer.testCall(
            serverId,
            testDecoratedClient
          ).next();
          const res2 = await TestDecoratedExternalGenServer.testCallExternal(
            serverId,
            testDecoratedClient
          ).next();
          await delay(500);
          await putMemoValue(canceler, false);
          return { first: res1.value, second: res2.value };
        })(),
      ]);
      expect(spyTestCall).toHaveBeenNthCalledWith(
        1,
        [{ test: "test" }, { test: "test" }],
        undefined
      );
      expect(spyTestCall).toHaveBeenNthCalledWith(
        2,
        [{ test: "test" }],
        undefined
      );
      expect(res[1]).toEqual({
        first: { test: "test" },
        second: { test: "test" },
      });
    });
  });
});
