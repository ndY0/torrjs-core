import { GenServer } from "./genserver";
import {
  RestartStrategy,
  ChildRestartStrategy,
  ChildSpec,
} from "../supervision/types";
import EventEmitter from "events";
import { GenSupervisor } from "./gensupervisor";
import { take } from "../effects";
import { supervise } from "../supervision";
import { tail } from "../utils";

abstract class GenDynamicSupervisor extends GenSupervisor {
  protected async *children() {
    return [];
  }
  protected async *init(): AsyncGenerator {
    return {
      strategy: RestartStrategy.ONE_FOR_ONE,
      childSpecs: [],
    };
  }
  protected async *run<
    U extends typeof GenServer,
    V extends typeof GenServer & (new () => GenServer)
  >(
    canceler: AsyncGenerator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>,
    context: U,
    {
      strategy,
      childSpecs,
    }: {
      childSpecs: [
        typeof GenServer & (new () => GenServer),
        GenServer,
        ChildSpec
      ][];
      strategy: RestartStrategy;
    }
  ): AsyncGenerator<
    void | {
      strategy: RestartStrategy;
      childSpecs: [
        typeof GenServer & (new () => GenServer),
        GenServer,
        ChildSpec
      ][];
    },
    any,
    any
  > {
    const { targetChild, spec } = yield* take<{
      spec: ChildSpec;
      targetChild: V;
    }>("startChild", context.eventEmitter, cancelerPromise);
    childSpecs.push([targetChild, new (<any>targetChild)(), spec]);
    tail(supervise(childSpecs, strategy, cancelerPromise), canceler);
    return yield {
      strategy,
      childSpecs,
    };
  }
  public async *childSpec(): AsyncGenerator<void, ChildSpec, unknown> {
    return {
      restart: ChildRestartStrategy.PERMANENT,
      shutdown: Infinity,
    };
  }
  public static async *startChild<
    U extends typeof GenDynamicSupervisor,
    V extends typeof GenServer & (new () => GenServer)
  >(targetSupervisor: U, targetChild: V, spec: ChildSpec) {
    yield* GenServer.cast<U>(
      [targetSupervisor, targetSupervisor.name],
      "startChild",
      { spec, targetChild }
    );
  }
}

export { GenDynamicSupervisor };
