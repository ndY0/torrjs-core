import {
  ChildSpec,
  ApplicationSpec,
  RestartStrategy,
} from "../supervision/types";
import { GenServer } from "./genserver";
import {
  tail,
  promisifyAsyncGenerator,
  memo,
  getMemoPromise,
  loopWorker,
  putMemoValue,
  getMemoValue,
  delay,
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
    /**
     * this is needed in order to keep event loop from exiting if all workers are awaiting in the take event state
     * (no execution would be scheduled otherwise)
     */
    const timeout = setInterval(
      /* istanbul ignore next */ () => {},
      Math.pow(2, 32) / 2 - 1
    );
    const childSpecs = await promisifyAsyncGenerator(this.init());
    await tail(
      (specs) => this.run(this.canceler, this.cancelerPromise, specs),
      this.canceler,
      {
        childSpecs,
        strategy: this.spec.childStrategy,
      },
      (specs) => specs.childSpecs.length === 0
    );
    clearInterval(timeout);
  }
  public async stop() {
    await putMemoValue(this.canceler, false);
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
  private async *run(
    canceler: AsyncGenerator<[boolean, EventEmitter], never, boolean>,
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
    return yield* supervise(childSpecs, strategy, canceler, cancelerPromise);
  }
}

export { GenApplication };
