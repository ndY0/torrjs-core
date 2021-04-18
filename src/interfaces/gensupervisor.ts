import {
  ChildSpec,
  ChildRestartStrategy,
  RestartStrategy,
} from "../supervision/types";
import { GenServer } from "./genserver";
import { tail } from "../utils";
import { supervise } from "../supervision";
import EventEmitter from "events";
import { keyForCombinedSelfReadable } from "../utils/symbols";
import { CombineEmitter } from "../transports/combine-emitter";

abstract class GenSupervisor extends GenServer {
  protected abstract children(): AsyncGenerator<
    unknown,
    (typeof GenServer & (new () => GenServer))[],
    unknown
  >;
  public async *start<U extends typeof GenServer>(
    startArgs: [RestartStrategy],
    context: U,
    canceler: AsyncGenerator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>
  ) {
    [
      context.eventEmitter,
      ...context.externalEventEmitters.values(),
    ].forEach((emitter) => emitter.resetInternalStreams());
    const combinableStreams = [
      context.eventEmitter,
      ...context.externalEventEmitters.values(),
    ].map((emitter) => {
      const stream = new (emitter.getInternalStreamType())();
      emitter.setStream(context.name, stream);
      return stream;
    });
    this[keyForCombinedSelfReadable] = new CombineEmitter(combinableStreams);
    const childSpecs = yield* this.init();
    await tail(
      (specs) => this.run(canceler, cancelerPromise, context, specs),
      canceler,
      {
        childSpecs,
        strategy: startArgs[0],
      },
      (specs) => specs.childSpecs.length === 0
    );
  }
  protected async *init(): AsyncGenerator {
    const children: [
      typeof GenServer,
      GenServer
    ][] = (yield* this.children()).map((Child) => [Child, new (<any>Child)()]);
    const childSpecs: [typeof GenServer, GenServer, ChildSpec][] = [];
    for (const [Child, child] of children) {
      childSpecs.push([Child, child, yield* child.childSpec()]);
    }
    return childSpecs;
  }
  protected async *run<U extends typeof GenServer>(
    canceler: AsyncGenerator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>,
    _context: U,
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
  public async *childSpec(): AsyncGenerator<void, ChildSpec, unknown> {
    return {
      startArgs: [RestartStrategy.ONE_FOR_ONE],
      restart: ChildRestartStrategy.PERMANENT,
      shutdown: Infinity,
    };
  }
}

export { GenSupervisor };
