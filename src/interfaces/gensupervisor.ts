import {
  ChildSpec,
  ChildRestartStrategy,
  RestartStrategy,
} from "../supervision/strategies";
import { GenServer } from "./genserver";
import { tail } from "../utils";
import { Class } from "../utils/types";
import { supervise } from "../supervision";

abstract class GenSupervisor {
  protected abstract children(): Class<GenServer>[];
  public async *start(
    strategy: RestartStrategy,
    canceler: AsyncGenerator<boolean, boolean, boolean>
  ) {
    const childSpecs = yield* this.init();
    await tail(this.run(childSpecs, strategy), canceler);
  }
  public async *init(): AsyncGenerator {
    const children = this.children().map((Child) => new Child());
    const childSpecs: [GenServer, ChildSpec][] = [];
    for (const child of children) {
      childSpecs.push([child, yield* child.childSpec()]);
    }
    return childSpecs;
  }
  public async *run(
    childSpecs: [GenServer, ChildSpec][],
    strategy: RestartStrategy
  ): AsyncGenerator {
    yield* supervise(childSpecs, strategy);
  }
  public async *childSpec(): AsyncGenerator<void, ChildSpec, unknown> {
    return {
      restart: ChildRestartStrategy.PERMANENT,
      shutdown: Infinity,
    };
  }
}

export { GenSupervisor };
