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
    any,
    {
      strategy: RestartStrategy;
      childSpecs: [
        typeof GenServer & (new () => GenServer),
        GenServer,
        ChildSpec
      ][];
    },
    any
  > {
    const { targetChild, spec } = yield* take<{
      spec: ChildSpec;
      targetChild: V;
    }>("startChild", context.eventEmitter, cancelerPromise);
    const child: [
      typeof GenServer & (new () => GenServer),
      GenServer,
      ChildSpec
    ] = [targetChild, new (<any>targetChild)(), spec];
    childSpecs.push(child);
    tail(() => supervise([child], strategy, cancelerPromise), canceler, null);
    return {
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
