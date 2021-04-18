import "reflect-metadata";
import { GenApplication } from "./genapplication";
import {
  ChildRestartStrategy,
  RestartStrategy,
  ChildSpec,
} from "../supervision/types";
import { getMemoPromise, memo, delay } from "../utils";
import { Server } from "../annotations/server";
import { InMemoryEmitter } from "../transports/in-memory-emitter";
import { GenSupervisor } from "./gensupervisor";
import { GenServer } from "./genserver";
import EventEmitter from "events";

class DelayNormalTemporaryServer extends GenServer {
  protected async *init(
    ...args: unknown[]
  ): AsyncGenerator<unknown, any, unknown> {
    return null;
  }
  public async *start<U extends typeof GenServer>(
    startArgs: any,
    context: U,
    canceler: Generator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>
  ) {
    await delay(200);
  }
  public async *childSpec(): AsyncGenerator<void, ChildSpec, unknown> {
    return {
      restart: ChildRestartStrategy.TEMPORARY,
      shutdown: 10_000,
    };
  }
}

@Server(new InMemoryEmitter(10), { test: new InMemoryEmitter(10) })
class TestTemporarySupervisor extends GenSupervisor {
  protected async *children() {
    return [DelayNormalTemporaryServer, DelayNormalTemporaryServer];
  }
}

describe("GenApplication", () => {
  it("should initialize a memo canceler and the linked promise at initialisation", () => {
    const application = new GenApplication({
      childStrategy: RestartStrategy.ONE_FOR_ALL,
      supervise: [DelayNormalTemporaryServer, TestTemporarySupervisor],
    });
    const memo1 = Reflect.get(application, "canceler");
    const memoPromise = Reflect.get(application, "cancelerPromise");
    expect(memo1.next).toBeInstanceOf(Function);
    expect(memoPromise).toBeInstanceOf(Promise);
  });
  describe("start", () => {
    it(`should loop supervised children with provided strategy --- ONE_FOR_ALL and stop when stop is called`, async () => {
      const application = new GenApplication({
        childStrategy: RestartStrategy.ONE_FOR_ALL,
        supervise: [DelayNormalTemporaryServer, TestTemporarySupervisor],
      });

      const initSpy = jest.spyOn(<any>application, "init");
      const runSpy = jest.spyOn(<any>application, "run");
      const res = await Promise.all([
        application.start(),
        (async (app) => {
          await delay(2000);
          await app.stop();
        })(application),
      ]);
      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(runSpy).not.toHaveBeenCalledTimes(0);
      expect(runSpy).not.toHaveBeenCalledTimes(1);
      await delay(1000);
    });
    it(`should loop supervised children with provided strategy --- ONE_FOR_ONE and stop when stop is called`, async () => {
      const application = new GenApplication({
        childStrategy: RestartStrategy.ONE_FOR_ONE,
        supervise: [DelayNormalTemporaryServer, TestTemporarySupervisor],
      });

      const initSpy = jest.spyOn(<any>application, "init");
      const runSpy = jest.spyOn(<any>application, "run");
      const res = await Promise.all([
        application.start(),
        (async (app) => {
          await delay(2000);
          await app.stop();
        })(application),
      ]);
      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(runSpy).not.toHaveBeenCalledTimes(0);
      expect(runSpy).toHaveBeenCalledTimes(1);
      await delay(1000);
    });
  });
});
