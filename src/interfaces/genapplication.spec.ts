import "reflect-metadata";
import { GenApplication } from "./genapplication";
import {
  ChildRestartStrategy,
  RestartStrategy,
  ChildSpec,
} from "../supervision/types";
import { getMemoPromise, memo, delay, promisifyGenerator } from "../utils";
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

@Server(new InMemoryEmitter(10), { test: new InMemoryEmitter(10) })
class TestGenApplication extends GenApplication {}

describe("GenApplication", () => {
  it("should initialize a memo canceler and the linked promise at initialisation", () => {
    const application = new TestGenApplication({
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
      const application = new TestGenApplication({
        childStrategy: RestartStrategy.ONE_FOR_ALL,
        supervise: [DelayNormalTemporaryServer, TestTemporarySupervisor],
      });

      const initSpy = jest.spyOn(<any>application, "init");
      const runSpy = jest.spyOn(<any>application, "run");
      await Promise.all([
        application.start(TestGenApplication),
        (async (app) => {
          await delay(2000);
          await TestGenApplication.stop(TestGenApplication);
          await delay(2000);
        })(application),
      ]);
      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(runSpy).not.toHaveBeenCalledTimes(0);
      expect(runSpy).not.toHaveBeenCalledTimes(1);
      await delay(1000);
    });
    it(`should loop supervised children with provided strategy --- ONE_FOR_ONE and stop when stop is called`, async () => {
      const application = new TestGenApplication({
        childStrategy: RestartStrategy.ONE_FOR_ONE,
        supervise: [DelayNormalTemporaryServer, TestTemporarySupervisor],
      });

      const initSpy = jest.spyOn(<any>application, "init");
      const runSpy = jest.spyOn(<any>application, "run");
      await Promise.all([
        application.start(TestGenApplication),
        (async (app) => {
          await delay(2000);
          await TestGenApplication.stop(TestGenApplication);
          await delay(2000);
        })(application),
      ]);
      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(runSpy).not.toHaveBeenCalledTimes(0);
      expect(runSpy).toHaveBeenCalledTimes(1);
      await delay(1000);
    });
  });
  describe("stop", () => {
    it("should send a stop signal to the application management loop", async () => {
      const application = new TestGenApplication({
        childStrategy: RestartStrategy.ONE_FOR_ONE,
        supervise: [DelayNormalTemporaryServer, TestTemporarySupervisor],
      });
      const res = await Promise.all([
        application.start(TestGenApplication),
        (async () => {
          await delay(1000);
          TestGenApplication.stop(TestGenApplication);
        })(),
      ]);
      expect(res[0]).toBeUndefined();
    });
  });
  describe("lookup", () => {
    it("should return the supervised children of the application", async () => {
      const application = new TestGenApplication({
        childStrategy: RestartStrategy.ONE_FOR_ONE,
        supervise: [DelayNormalTemporaryServer, TestTemporarySupervisor],
      });
      const testServer = new DelayNormalTemporaryServer();
      const res = await Promise.all([
        application.start(TestGenApplication),
        (async () => {
          await delay(1000);
          const children = await TestGenApplication.lookup(
            TestGenApplication,
            testServer
          );
          expect(children).toHaveLength(1);
          TestGenApplication.stop(TestGenApplication);
        })(),
      ]);
      expect(res[0]).toBeUndefined();
    });
  });
  describe("stopChild", () => {
    it("should stop the application child, given its server id", async () => {
      const application = new TestGenApplication({
        childStrategy: RestartStrategy.ONE_FOR_ONE,
        supervise: [DelayNormalTemporaryServer, TestTemporarySupervisor],
      });
      const testServer = new DelayNormalTemporaryServer();
      const res = await Promise.all([
        application.start(TestGenApplication),
        (async () => {
          await delay(1000);
          const children = await TestGenApplication.lookup(
            TestGenApplication,
            testServer
          );
          expect(children).toHaveLength(1);
          TestGenApplication.stopChild(TestGenApplication, children[0]);
          await delay(200);
          const children2 = await TestGenApplication.lookup(
            TestGenApplication,
            testServer,
            "test"
          );
          expect(children2).toHaveLength(0);
          TestGenApplication.stop(TestGenApplication);
        })(),
      ]);
      expect(res[0]).toBeUndefined();
    });
    it("should do nothing if the server id is not one of supervised", async () => {
      const application = new TestGenApplication({
        childStrategy: RestartStrategy.ONE_FOR_ONE,
        supervise: [DelayNormalTemporaryServer, TestTemporarySupervisor],
      });
      const testServer = new DelayNormalTemporaryServer();
      const res = await Promise.all([
        application.start(TestGenApplication),
        (async () => {
          await delay(1000);
          const children = await TestGenApplication.lookup(
            TestGenApplication,
            testServer
          );
          expect(children).toHaveLength(1);
          TestGenApplication.stopChild(TestGenApplication, "invalid");
          await delay(200);
          const children2 = await TestGenApplication.lookup(
            TestGenApplication,
            testServer,
            "test"
          );
          expect(children2).toHaveLength(1);
          TestGenApplication.stop(TestGenApplication);
        })(),
      ]);
      expect(res[0]).toBeUndefined();
    });
  });
  it("should do nothing if provided event for management loop is not recognised", async () => {
    const application = new TestGenApplication({
      childStrategy: RestartStrategy.ONE_FOR_ONE,
      supervise: [DelayNormalTemporaryServer, TestTemporarySupervisor],
    });
    const res = await Promise.all([
      application.start(TestGenApplication),
      (async () => {
        await delay(1000);
        await promisifyGenerator(
          GenServer.cast<typeof GenServer>(
            [
              <any>TestGenApplication,
              `${TestGenApplication.name}_management`,
              undefined,
            ],
            "internal",
            {}
          )
        );
        await delay(1000);
        TestGenApplication.stop(TestGenApplication);
      })(),
    ]);
    expect(res[0]).toBeUndefined();
  });
});
