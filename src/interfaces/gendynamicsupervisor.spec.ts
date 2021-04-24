import "reflect-metadata";
import { GenDynamicSupervisor } from "./gendynamicsupervisor";
import { InMemoryEmitter } from "../transports/in-memory-emitter";
import { Server } from "../annotations/server";
import {
  ChildRestartStrategy,
  RestartStrategy,
  ChildSpec,
} from "../supervision/types";
import { memo, getMemoPromise, delay, putMemoValue } from "../utils";
import { GenServer } from "./genserver";
import EventEmitter from "events";
import { GenSupervisor } from "./gensupervisor";

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
class TestDynamicSupervisor extends GenDynamicSupervisor {
  protected async *children() {
    return [DelayNormalTemporaryServer];
  }
}

describe("GenDynamicSupervisor", () => {
  describe("childSpec", () => {
    it("should return the gensupervisor configuration", async () => {
      const supervisor = new TestDynamicSupervisor();
      const res = await supervisor.childSpec().next();
      expect(res.value).toEqual({
        restart: ChildRestartStrategy.PERMANENT,
        shutdown: Infinity,
      });
    });
  });
  describe("children", () => {
    it("should have an empty set of children at creation", async () => {
      const supervisor = new TestDynamicSupervisor();
      const children = Reflect.get(supervisor, "children");
      const list = await children().next();
      expect(list.value).toBeInstanceOf(Array);
    });
  });
  describe("start", () => {
    it("should call init, then run, and await for an event", async () => {
      const supervisor = new TestDynamicSupervisor();
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const initSpy = jest.spyOn(supervisor, "init");
      const runSpy = jest.spyOn(supervisor, "run");
      await Promise.all([
        supervisor
          .start(
            [RestartStrategy.ONE_FOR_ONE],
            TestDynamicSupervisor,
            canceler,
            cancelerPromise
          )
          .next(),
        (async () => {
          await delay(300);
          expect(initSpy).toHaveBeenCalledTimes(1);
          expect(runSpy).toHaveBeenCalledTimes(1);
          putMemoValue(canceler, false);
        })(),
      ]);
    });
  });
  describe("startChild", () => {
    it("should start a new supervised child or supervisor child, looping supervisor run loop for one iteration", async () => {
      const supervisor = new TestDynamicSupervisor();
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const initSpy = jest.spyOn(supervisor, "init");
      const runSpy = jest.spyOn(supervisor, "run");
      await Promise.all([
        supervisor
          .start(
            [RestartStrategy.ONE_FOR_ONE],
            TestDynamicSupervisor,
            canceler,
            cancelerPromise
          )
          .next(),
        (async () => {
          await delay(200);
          await GenDynamicSupervisor.startChild(
            TestDynamicSupervisor,
            DelayNormalTemporaryServer,
            {
              restart: ChildRestartStrategy.TEMPORARY,
            }
          ).next();
          await GenDynamicSupervisor.startChild(
            TestDynamicSupervisor,
            DelayNormalTemporaryServer,
            {
              restart: ChildRestartStrategy.TEMPORARY,
            },
            "test"
          ).next();
          await delay(1000);
          expect(initSpy).toHaveBeenCalledTimes(1);
          expect(runSpy).toHaveBeenCalledTimes(3);
          putMemoValue(canceler, false);
        })(),
      ]);
    });
  });
});
