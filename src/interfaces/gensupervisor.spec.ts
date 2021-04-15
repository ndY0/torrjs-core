import "reflect-metadata";
import { GenSupervisor } from "./gensupervisor";
import { GenServer } from "./genserver";
import {
  ChildRestartStrategy,
  ChildSpec,
  RestartStrategy,
} from "../supervision/types";
import EventEmitter from "events";
import {
  delay,
  getMemoValue,
  memo,
  getMemoPromise,
  putMemoValue,
} from "../utils";

class DelayFailurePermanentServer extends GenServer {
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
    throw new Error("");
  }
  public async *childSpec(): AsyncGenerator<void, ChildSpec, unknown> {
    return {
      restart: ChildRestartStrategy.PERMANENT,
      shutdown: 10_000,
    };
  }
}

class DelayFailureTransientServer extends GenServer {
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
    throw new Error("");
  }
  public async *childSpec(): AsyncGenerator<void, ChildSpec, unknown> {
    return {
      restart: ChildRestartStrategy.TRANSIENT,
      shutdown: 10_000,
    };
  }
}

class DelayFailureTemporaryServer extends GenServer {
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
    throw new Error("");
  }
  public async *childSpec(): AsyncGenerator<void, ChildSpec, unknown> {
    return {
      restart: ChildRestartStrategy.TEMPORARY,
      shutdown: 10_000,
    };
  }
}

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

class DelayNormalTransientServer extends GenServer {
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
      restart: ChildRestartStrategy.TRANSIENT,
      shutdown: 10_000,
    };
  }
}

class PermanentCancellableServer extends GenServer {
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
    while (await getMemoValue(canceler)) {
      await delay(300);
    }
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
    canceler: AsyncGenerator<[boolean, EventEmitter], never, boolean>,
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

class TestPermanentSupervisor extends GenSupervisor {
  protected async *children() {
    return [DelayNormalPermanentServer, DelayNormalPermanentServer];
  }
}

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
          RestartStrategy.ONE_FOR_ALL,
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
          RestartStrategy.ONE_FOR_ONE,
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
          RestartStrategy.ONE_FOR_ONE,
          TestPermanentSupervisor,
          canceler,
          cancelerPromise
        )
        .next();
      expect(test.done).toBeTruthy();
    });
  });
});