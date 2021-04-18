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
import { tail, getMemoValue } from "../utils";
import { keyForCombinedSelfReadable } from "../utils/symbols";
import { ServerEvent } from "../events/types";

abstract class GenDynamicSupervisor extends GenSupervisor {
  protected async *children() {
    return [];
  }
  protected async *init(): AsyncGenerator {
    return [];
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
    const res = yield* take<
      ServerEvent<{
        spec: ChildSpec;
        targetChild: V;
      }>
    >(context.name, this[keyForCombinedSelfReadable], cancelerPromise);
    if (await getMemoValue(canceler)) {
      const child: [
        typeof GenServer & (new () => GenServer),
        GenServer,
        ChildSpec
      ] = [
        res.data[0].targetChild,
        new (<any>res.data[0].targetChild)(),
        res.data[0].spec,
      ];
      childSpecs.push(child);
      tail(
        () => supervise([child], strategy, canceler, cancelerPromise),
        canceler,
        null
      );
      return {
        strategy,
        childSpecs,
      };
    } else {
      return {
        strategy,
        childSpecs: [],
      };
    }
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
  >(targetSupervisor: U, targetChild: V, spec: ChildSpec, transport?: string) {
    yield* GenServer.cast<U>(
      [targetSupervisor, targetSupervisor.name, transport],
      "startChild",
      { spec, targetChild }
    );
  }
}

export { GenDynamicSupervisor };
