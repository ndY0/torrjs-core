import {
  ChildSpec,
  ChildRestartStrategy,
  RestartStrategy,
} from "../supervision/strategies";
import { GenServer } from "./genserver";
import { tail } from "../utils";
import { supervise } from "../supervision";
import EventEmitter from "events";

abstract class GenSupervisor extends GenServer {
  protected abstract children(): AsyncGenerator<
    unknown,
    (typeof GenServer & (new () => GenServer))[],
    unknown
  >;
  public async *start<U extends typeof GenServer>(
    startArgs: RestartStrategy,
    context: U,
    canceler: AsyncGenerator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>
  ) {
    const childSpecs = yield* this.init();
    await tail(
      this.run(cancelerPromise, context, { childSpecs, strategy: startArgs }),
      canceler
    );
  }
  public async *init(): AsyncGenerator {
    const children: [
      typeof GenServer,
      GenServer
    ][] = (yield* this.children()).map((Child) => [Child, new Child()]);
    const childSpecs: [typeof GenServer, GenServer, ChildSpec][] = [];
    for (const [Child, child] of children) {
      childSpecs.push([Child, child, yield* child.childSpec()]);
    }
    return childSpecs;
  }
  public async *run<U extends typeof GenServer>(
    cancelerPromise: Promise<boolean>,
    _context: U,
    {
      strategy,
      childSpecs,
    }: {
      childSpecs: [typeof GenServer, GenServer, ChildSpec][];
      strategy: RestartStrategy;
    }
  ) {
    yield* supervise(childSpecs, strategy, cancelerPromise);
  }
  public async *childSpec(): AsyncGenerator<void, ChildSpec, unknown> {
    return {
      restart: ChildRestartStrategy.PERMANENT,
      shutdown: Infinity,
    };
  }
}

export { GenSupervisor };
