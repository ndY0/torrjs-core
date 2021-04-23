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
import { tail, getMemoValue, memo } from "../utils";
import { keyForCombinedSelfReadable, keyForIdSymbol } from "../utils/symbols";
import { ServerEvent } from "../events/types";

abstract class GenDynamicSupervisor extends GenSupervisor {
  protected async *init(): AsyncGenerator {
    return [];
  }
  protected async *run<
    U extends typeof GenServer,
    V extends typeof GenServer & (new () => GenServer)
  >(
    canceler: Generator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>,
    context: U,
    supervised: {
      id: string | null;
      canceler: Generator<[boolean, EventEmitter], never, boolean>;
    }[],
    {
      strategy,
      childSpecs,
    }: {
      childSpecs: [
        typeof GenServer & (new () => GenServer),
        GenServer,
        ChildSpec,
        Generator<[boolean, EventEmitter], never, boolean>
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
        ChildSpec,
        Generator<[boolean, EventEmitter], never, boolean>
      ][];
    },
    any
  > {
    const res = yield* take<
      ServerEvent<{
        spec: ChildSpec;
        targetChild: string;
      }>
    >(context.name, this[keyForCombinedSelfReadable], cancelerPromise);
    if (getMemoValue(canceler)) {
      const supportedChildren = yield* this.children();
      const childClass = <V & (new () => GenServer)>(
        (<any>(
          supportedChildren.find(
            (child) => (<any>child).name === res.data[0].targetChild
          )
        ))
      );
      const child: [
        typeof GenServer & (new () => GenServer),
        GenServer,
        ChildSpec,
        Generator<[boolean, EventEmitter], never, boolean>
      ] = [childClass, new (<any>childClass)(), res.data[0].spec, memo(true)];
      supervised.push({
        id: child[1][keyForIdSymbol],
        canceler: child[3],
      });
      childSpecs.push(child);
      tail(
        () =>
          supervise(
            [child],
            strategy,
            canceler,
            cancelerPromise,
            supervised.slice(supervised.length - 1, supervised.length)
          ),
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
  >(
    targetSupervisor: U,
    targetChild: V & (V extends typeof GenSupervisor ? never : V),
    spec: ChildSpec,
    transport?: string
  ) {
    yield* GenServer.cast<U>(
      [targetSupervisor, targetSupervisor.name, transport],
      "startChild",
      { spec, targetChild: targetChild.name }
    );
  }
}

export { GenDynamicSupervisor };
