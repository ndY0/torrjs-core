import { Server } from "../annotations/server";
import { InMemoryEmitter } from "../transports/in-memory-emitter";
import { GenSupervisor } from "./gensupervisor";
import { GenServer } from "./genserver";
import EventEmitter from "events";
import {
  ChildSpec,
  ChildRestartStrategy,
  RestartStrategy,
} from "../supervision/types";
import { delay, memo, getMemoPromise } from "../utils";

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
    await delay(1);
  }
  public async *childSpec(): AsyncGenerator<void, ChildSpec, unknown> {
    return {
      restart: ChildRestartStrategy.PERMANENT,
      shutdown: 10_000,
    };
  }
}

@Server(new InMemoryEmitter(10), { test: new InMemoryEmitter(10) })
class TestPermanentChildSupervisor extends GenSupervisor {
  protected async *children() {
    return [DelayNormalPermanentServer, DelayNormalPermanentServer];
  }
}

@Server(new InMemoryEmitter(10), { test: new InMemoryEmitter(10) })
class TestPermanentSupervisor extends GenSupervisor {
  protected async *children() {
    return [DelayNormalPermanentServer, TestPermanentChildSupervisor];
  }
}

describe("GenSupervisor", () => {
  it("should loop children indefinitely in ONE_FOR_ALL strategy without memory leakage", async () => {
    const supervisor = new TestPermanentSupervisor();
    const canceler = memo(true);
    const cancelerPromise = getMemoPromise(canceler);
    const runSpy = jest.spyOn(supervisor, "run");
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
        await delay(90_000);
        expect(runSpy.mock.calls.length).toBeGreaterThan(9000);
        await TestPermanentSupervisor.stop(
          TestPermanentSupervisor,
          TestPermanentSupervisor.name
        ).next();
      })(),
    ]);
  });
  it("should loop children indefinitely in ONE_FOR_ONE strategy without memory leakage", async () => {
    const supervisor = new TestPermanentSupervisor();
    const canceler = memo(true);
    const cancelerPromise = getMemoPromise(canceler);
    const runSpy = jest.spyOn(supervisor, "run");
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
        await delay(90_000);
        expect(runSpy).toHaveBeenCalledTimes(1);
        await TestPermanentSupervisor.stop(
          TestPermanentSupervisor,
          TestPermanentSupervisor.name
        ).next();
      })(),
    ]);
  });
});
