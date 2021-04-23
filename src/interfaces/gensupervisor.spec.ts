import "reflect-metadata";
import { GenSupervisor } from "./gensupervisor";
import { GenServer } from "./genserver";
import {
  ChildRestartStrategy,
  ChildSpec,
  RestartStrategy,
} from "../supervision/types";
import EventEmitter from "events";
import { delay, memo, getMemoPromise, putMemoValue } from "../utils";
import { Server } from "../annotations/server";
import { InMemoryEmitter } from "../transports/in-memory-emitter";

class DelayNormalPermanentServer extends GenServer {
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
      restart: ChildRestartStrategy.PERMANENT,
      shutdown: 10_000,
    };
  }
}

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
class TestPermanentSupervisor extends GenSupervisor {
  protected async *children() {
    return [DelayNormalPermanentServer, DelayNormalPermanentServer];
  }
}

@Server(new InMemoryEmitter(10), { test: new InMemoryEmitter(10) })
class TestNestedPermanentSupervisor extends GenSupervisor {
  protected async *children() {
    return [
      DelayNormalPermanentServer,
      DelayNormalPermanentServer,
      TestPermanentSupervisor,
    ];
  }
}

@Server(new InMemoryEmitter(10), { test: new InMemoryEmitter(10) })
class TestTemporarySupervisor extends GenSupervisor {
  protected async *children() {
    return [DelayNormalTemporaryServer, DelayNormalTemporaryServer];
  }
}

describe("GenSupervisor", () => {
  describe("childSpec", () => {
    it("should provide the default implementation of supervisor spec", async () => {
      const supervisor = new TestPermanentSupervisor();
      const childSpec = await supervisor.childSpec().next();
      expect(childSpec.value).toEqual({
        startArgs: [RestartStrategy.ONE_FOR_ONE],
        restart: ChildRestartStrategy.PERMANENT,
        shutdown: Infinity,
      });
    });
  });
  describe("start", () => {
    it(`should loop supervised children with provided strategy --- ONE_FOR_ALL and stop when canceler is triggered`, async () => {
      const supervisor = new TestPermanentSupervisor();

      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const initSpy = jest.spyOn(supervisor, "init");
      const runSpy = jest.spyOn(supervisor, "run");
      supervisor
        .start(
          [RestartStrategy.ONE_FOR_ALL],
          TestPermanentSupervisor,
          canceler,
          cancelerPromise
        )
        .next();
      await delay(5_000);
      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(runSpy).not.toHaveBeenCalledTimes(0);
      expect(runSpy).not.toHaveBeenCalledTimes(1);
      putMemoValue(canceler, false);
      await delay(1000);
    });
    it(`should loop supervised children with provided strategy --- ONE_FOR_ONE and stop when canceler is triggered`, async () => {
      const supervisor = new TestPermanentSupervisor();

      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const initSpy = jest.spyOn(supervisor, "init");
      const runSpy = jest.spyOn(supervisor, "run");
      supervisor
        .start(
          [RestartStrategy.ONE_FOR_ONE],
          TestPermanentSupervisor,
          canceler,
          cancelerPromise
        )
        .next();
      await delay(5_000);
      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(runSpy).toHaveBeenCalledTimes(1);
      putMemoValue(canceler, false);
      await delay(1000);
    });
    it("should stop by itself, is no children is provided for iteration", async () => {
      const supervisor = new TestTemporarySupervisor();

      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const test = await supervisor
        .start(
          [RestartStrategy.ONE_FOR_ONE],
          TestPermanentSupervisor,
          canceler,
          cancelerPromise
        )
        .next();
      expect(test.done).toBeTruthy();
    });
  });
  describe("stopChild", () => {
    it("should stop a running children, refreshing the state in next iteration in ONE_FOR_ALL strategy", async () => {
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const supervisor = new TestPermanentSupervisor();
      await Promise.all([
        supervisor
          .start(
            [RestartStrategy.ONE_FOR_ALL],
            TestPermanentSupervisor,
            canceler,
            cancelerPromise
          )
          .next(),
        (async () => {
          await delay(1_000);
          const children = await TestPermanentSupervisor.lookup(
            TestPermanentSupervisor,
            supervisor
          ).next();
          expect(children.value).toHaveLength(2);
          const childId = children.value ? children.value[0] : "2";
          await TestPermanentSupervisor.stopChild(
            TestPermanentSupervisor,
            childId
          ).next();
          await delay(500);
          const children2 = await TestPermanentSupervisor.lookup(
            TestPermanentSupervisor,
            supervisor
          ).next();
          expect(children2.value).toHaveLength(1);
          await TestPermanentSupervisor.stop(
            TestPermanentSupervisor,
            TestPermanentSupervisor.name
          ).next();
          await delay(200);
        })(),
      ]);
    });
    it("should stop a running children, refreshing the state in next iteration in ONE_FOR_ONE strategy", async () => {
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const supervisor = new TestPermanentSupervisor();
      await Promise.all([
        supervisor
          .start(
            [RestartStrategy.ONE_FOR_ONE],
            TestPermanentSupervisor,
            canceler,
            cancelerPromise
          )
          .next(),
        (async () => {
          await delay(1_000);
          const children = await TestPermanentSupervisor.lookup(
            TestPermanentSupervisor,
            supervisor
          ).next();
          expect(children.value).toHaveLength(2);
          const childId = children.value ? children.value[0] : "2";
          await TestPermanentSupervisor.stopChild(
            TestPermanentSupervisor,
            childId
          ).next();
          await delay(500);
          const children2 = await TestPermanentSupervisor.lookup(
            TestPermanentSupervisor,
            supervisor
          ).next();
          expect(children2.value).toHaveLength(1);
          await TestPermanentSupervisor.stop(
            TestPermanentSupervisor,
            TestPermanentSupervisor.name
          ).next();
          await delay(200);
        })(),
      ]);
    });
    it("should stop a running supervisor and it's running children, refreshing the state in next iteration in ONE_FOR_ALL strategy", async () => {
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const supervisor = new TestNestedPermanentSupervisor();
      await Promise.all([
        supervisor
          .start(
            [RestartStrategy.ONE_FOR_ALL],
            TestNestedPermanentSupervisor,
            canceler,
            cancelerPromise
          )
          .next(),
        (async () => {
          await delay(1_000);
          const children = await TestNestedPermanentSupervisor.lookup(
            TestNestedPermanentSupervisor,
            supervisor
          ).next();
          expect(children.value).toHaveLength(3);
          await TestNestedPermanentSupervisor.stopChild(
            TestNestedPermanentSupervisor,
            "TestPermanentSupervisor"
          ).next();
          await delay(500);
          const children2 = await TestNestedPermanentSupervisor.lookup(
            TestNestedPermanentSupervisor,
            supervisor
          ).next();
          expect(children2.value).toHaveLength(2);
          await TestNestedPermanentSupervisor.stop(
            TestNestedPermanentSupervisor,
            TestNestedPermanentSupervisor.name
          ).next();
          await delay(200);
        })(),
      ]);
    });
    it("should stop a running supervisor and it's running children, refreshing the state in next iteration in ONE_FOR_ONE strategy", async () => {
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const supervisor = new TestNestedPermanentSupervisor();
      await Promise.all([
        supervisor
          .start(
            [RestartStrategy.ONE_FOR_ONE],
            TestNestedPermanentSupervisor,
            canceler,
            cancelerPromise
          )
          .next(),
        (async () => {
          await delay(1_000);
          const children = await TestNestedPermanentSupervisor.lookup(
            TestNestedPermanentSupervisor,
            supervisor
          ).next();
          expect(children.value).toHaveLength(3);
          await TestNestedPermanentSupervisor.stopChild(
            TestNestedPermanentSupervisor,
            "TestPermanentSupervisor"
          ).next();
          await delay(500);
          const children2 = await TestNestedPermanentSupervisor.lookup(
            TestNestedPermanentSupervisor,
            supervisor
          ).next();
          expect(children2.value).toHaveLength(2);
          await TestNestedPermanentSupervisor.stop(
            TestNestedPermanentSupervisor,
            TestNestedPermanentSupervisor.name
          ).next();
          await delay(200);
        })(),
      ]);
    });
    it("should do nothing if provided children isn't managed by the supervisor", async () => {
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const supervisor = new TestPermanentSupervisor();
      await Promise.all([
        supervisor
          .start(
            [RestartStrategy.ONE_FOR_ONE],
            TestPermanentSupervisor,
            canceler,
            cancelerPromise
          )
          .next(),
        (async () => {
          await delay(1_000);
          const children = await TestPermanentSupervisor.lookup(
            TestPermanentSupervisor,
            supervisor
          ).next();
          expect(children.value).toHaveLength(2);
          const childId = "invalid";
          await TestPermanentSupervisor.stopChild(
            TestPermanentSupervisor,
            childId
          ).next();
          await delay(500);
          const children2 = await TestPermanentSupervisor.lookup(
            TestPermanentSupervisor,
            supervisor
          ).next();
          expect(children2.value).toHaveLength(2);
          await TestPermanentSupervisor.stop(
            TestPermanentSupervisor,
            TestPermanentSupervisor.name
          ).next();
          await delay(200);
        })(),
      ]);
    });
  });
  describe("lookup", () => {
    it("should return the running managed children, using internal transport", async () => {
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const supervisor = new TestPermanentSupervisor();
      await Promise.all([
        supervisor
          .start(
            [RestartStrategy.ONE_FOR_ALL],
            TestPermanentSupervisor,
            canceler,
            cancelerPromise
          )
          .next(),
        (async () => {
          await delay(1_000);
          const children = await TestPermanentSupervisor.lookup(
            TestPermanentSupervisor,
            supervisor
          ).next();
          expect(children.value).toHaveLength(2);
          await TestPermanentSupervisor.stop(
            TestPermanentSupervisor,
            TestPermanentSupervisor.name
          ).next();
          await delay(200);
        })(),
      ]);
    });
    it("should return the running managed children, using external transport", async () => {
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const supervisor = new TestPermanentSupervisor();
      await Promise.all([
        supervisor
          .start(
            [RestartStrategy.ONE_FOR_ALL],
            TestPermanentSupervisor,
            canceler,
            cancelerPromise
          )
          .next(),
        (async () => {
          await delay(1_000);
          const children = await TestPermanentSupervisor.lookup(
            TestPermanentSupervisor,
            supervisor,
            "test"
          ).next();
          expect(children.value).toHaveLength(2);
          await TestPermanentSupervisor.stop(
            TestPermanentSupervisor,
            TestPermanentSupervisor.name
          ).next();
          await delay(200);
        })(),
      ]);
    });
    it("if one of the childs is a supervisor, the class name should be returned as child id", async () => {
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const supervisor = new TestNestedPermanentSupervisor();
      await Promise.all([
        supervisor
          .start(
            [RestartStrategy.ONE_FOR_ALL],
            TestNestedPermanentSupervisor,
            canceler,
            cancelerPromise
          )
          .next(),
        (async () => {
          await delay(1_000);
          const children = await TestNestedPermanentSupervisor.lookup(
            TestNestedPermanentSupervisor,
            supervisor
          ).next();
          expect(
            (children.value ? children.value : []).includes(
              "TestPermanentSupervisor"
            )
          ).toBeTruthy();
          await TestNestedPermanentSupervisor.stop(
            TestNestedPermanentSupervisor,
            TestNestedPermanentSupervisor.name
          ).next();
          await delay(200);
        })(),
      ]);
    });
  });
  describe("stop", () => {
    it("should send a stop event to the management loop, and stop the supervisor and it's children", async () => {
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const supervisor = new TestPermanentSupervisor();
      const res = await Promise.all([
        supervisor
          .start(
            [RestartStrategy.ONE_FOR_ALL],
            TestPermanentSupervisor,
            canceler,
            cancelerPromise
          )
          .next(),
        (async () => {
          await delay(1_000);
          await TestPermanentSupervisor.stop(
            TestPermanentSupervisor,
            TestPermanentSupervisor.name
          ).next();
        })(),
      ]);
      expect(res[0].done).toBeTruthy();
    });
  });
});
