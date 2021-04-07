import {
  ChildSpec,
  ChildRestartStrategy,
  RestartStrategy,
} from "../supervision/strategies";
import { GenServer } from "./genserver";
import { tail } from "../utils";
import { Class } from "../utils/types";
import { supervise } from "../supervision";
import EventEmitter from "events";

abstract class GenSupervisor {
  protected abstract children(): typeof GenServer[];
  public async *start(
    strategy: RestartStrategy,
    canceler: AsyncGenerator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>
  ) {
    const childSpecs = yield* this.init();
    await tail(this.run(cancelerPromise, childSpecs, strategy), canceler);
  }
  public async *init(): AsyncGenerator {
    const children: [
      typeof GenServer,
      GenServer
    ][] = this.children().map((Child) => [
      Child,
      new (<any>(<unknown>Child))(),
    ]);
    const childSpecs: [typeof GenServer, GenServer, ChildSpec][] = [];
    for (const [Child, child] of children) {
      childSpecs.push([Child, child, yield* child.childSpec()]);
    }
    return childSpecs;
  }
  public async *run(
    cancelerPromise: Promise<boolean>,
    childSpecs: [typeof GenServer, GenServer, ChildSpec][],
    strategy: RestartStrategy
  ): AsyncGenerator {
    //here
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
