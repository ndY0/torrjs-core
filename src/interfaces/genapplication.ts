import {
  ChildSpec,
  ApplicationSpec,
  RestartStrategy,
  ChildRestartStrategy,
} from "../supervision/types";
import { GenServer } from "./genserver";
import {
  tail,
  promisifyAsyncGenerator,
  memo,
  getMemoPromise,
  loopWorker,
} from "../utils";
import EventEmitter from "events";
import { supervise } from "../supervision";

class GenApplication<T extends typeof GenServer & (new () => GenServer)> {
  private canceler: AsyncGenerator<[boolean, EventEmitter], never, boolean>;
  private cancelerPromise: Promise<boolean>;
  public constructor(private readonly spec: ApplicationSpec<T>) {
    this.canceler = memo(true);
    this.cancelerPromise = getMemoPromise(this.canceler);
  }
  public async start() {
    await loopWorker(
      async () => {
        const childSpecs = await promisifyAsyncGenerator(this.init());
        await tail(
          (specs) => this.run(this.canceler, this.cancelerPromise, specs),
          this.canceler,
          {
            childSpecs,
            strategy: this.spec.childStrategy,
          }
        );
      },
      this.spec.strategy,
      this.canceler
    );
  }
  public async stop() {
    await this.canceler.next(false);
    await new Promise<void>((resolve) =>
      setTimeout(() => resolve(), this.spec.strategy.shutdown)
    );
  }
  private async *init(): AsyncGenerator {
    const children: [
      typeof GenServer,
      GenServer
    ][] = this.spec.supervise.map((Child) => [Child, new (<any>Child)()]);
    const childSpecs: [typeof GenServer, GenServer, ChildSpec][] = [];
    for (const [Child, child] of children) {
      childSpecs.push([Child, child, yield* child.childSpec()]);
    }
    return childSpecs;
  }
  private async *run<U extends typeof GenServer>(
    _canceler: AsyncGenerator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>,
    {
      strategy,
      childSpecs,
    }: {
      childSpecs: [typeof GenServer, GenServer, ChildSpec][];
      strategy: RestartStrategy;
    }
  ): AsyncGenerator<
    any,
    {
      childSpecs: [typeof GenServer, GenServer, ChildSpec][];
      strategy: RestartStrategy;
    },
    undefined
  > {
    return yield* supervise(childSpecs, strategy, cancelerPromise);
  }
}

export { GenApplication };
