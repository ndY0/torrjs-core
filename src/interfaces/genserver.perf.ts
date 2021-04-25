import { handle } from "../annotations/handle";
import { Server } from "../annotations/server";
import { InMemoryEmitter } from "../transports/in-memory-emitter";
import { GenServer } from "./genserver";
import { ReplyTypes } from "../events/types";
import { memo, getMemoPromise, delay } from "../utils";
import { keyForIdSymbol } from "../utils/symbols";

@Server(new InMemoryEmitter(100_000))
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

@Server(new InMemoryEmitter(1_000))
class TestDecoratedGenServer2 extends GenServer {
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

describe("GenServer", () => {
  it("should handle a long queue of messages from one client from a cast operation", async () => {
    const server = new TestDecoratedGenServer();
    const canceler = memo(true);
    const cancelerPromise = getMemoPromise(canceler);
    const handleTestCastSpy = jest.spyOn(server, "handleTestCast");
    await Promise.all([
      server
        .start([], TestDecoratedGenServer, canceler, cancelerPromise)
        .next(),
      (async () => {
        for (let index = 0; index < 300_000; index++) {
          await TestDecoratedGenServer.testCast(
            server[keyForIdSymbol],
            {}
          ).next();
        }
        await delay(10000);
        expect(handleTestCastSpy).toHaveBeenCalledTimes(300_000);
        await TestDecoratedGenServer.stop(
          TestDecoratedGenServer,
          server[keyForIdSymbol]
        ).next();
      })(),
    ]);
  });
  it("should handle a long queue of messages from one client from a call operation", async () => {
    const server = new TestDecoratedGenServer();
    const client = new TestDecoratedGenServer();
    const canceler = memo(true);
    const cancelerPromise = getMemoPromise(canceler);
    let counter = 0;
    await Promise.all([
      server
        .start([], TestDecoratedGenServer, canceler, cancelerPromise)
        .next(),
      (async () => {
        for (let index = 0; index < 150_000; index++) {
          await TestDecoratedGenServer.testCast(
            server[keyForIdSymbol],
            {}
          ).next();
        }
        for (let index = 0; index < 150_000; index++) {
          const result = (
            await TestDecoratedGenServer.testCall(
              server[keyForIdSymbol],
              client
            ).next()
          ).value;
          expect(result).toEqual({});
          counter += 1;
        }
        console.log(counter);
        expect(counter).toEqual(150_000);
        await TestDecoratedGenServer.stop(
          TestDecoratedGenServer,
          server[keyForIdSymbol]
        ).next();
      })(),
    ]);
  });
  it("should handle a large amount of clients from a call operation", async () => {
    const server = new TestDecoratedGenServer2();
    const clients = Array.from({ length: 150_000 }).map(
      (_) => new TestDecoratedGenServer2()
    );
    const canceler = memo(true);
    const cancelerPromise = getMemoPromise(canceler);
    let counter = 0;
    await Promise.all([
      server
        .start([], TestDecoratedGenServer, canceler, cancelerPromise)
        .next(),
      (async () => {
        for (let index = 0; index < 150_000; index++) {
          await TestDecoratedGenServer.testCast(server[keyForIdSymbol], {
            id: counter,
          }).next();
          counter += 1;
        }
        counter -= 1;
        await delay(100);
        await Promise.all(
          Array.from({ length: 150_000 }).map((_, index) =>
            (async () => {
              const res = await TestDecoratedGenServer.testCall(
                server[keyForIdSymbol],
                clients[index]
              ).next();
              expect((<{ id: number }>res.value).id).toEqual(counter);
              counter -= 1;
            })()
          )
        );
        await TestDecoratedGenServer.stop(
          TestDecoratedGenServer,
          server[keyForIdSymbol]
        ).next();
      })(),
    ]);
  });
});
