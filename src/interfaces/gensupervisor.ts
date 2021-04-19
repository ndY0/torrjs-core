import {
  ChildSpec,
  ChildRestartStrategy,
  RestartStrategy,
} from "../supervision/types";
import { GenServer } from "./genserver";
import {
  tail,
  putMemoValue,
  getMemoPromise,
  combineMemos,
  memo,
} from "../utils";
import { supervise } from "../supervision";
import EventEmitter from "events";
import { keyForCombinedSelfReadable } from "../utils/symbols";
import { CombineEmitter } from "../transports/combine-emitter";
import { take } from "../effects";
import { ServerEvent } from "../events/types";

// TODO : implements supervisors management calls, supervisors child registration, server management calls
abstract class GenSupervisor extends GenServer {
  protected abstract children(): AsyncGenerator<
    unknown,
    (typeof GenServer & (new () => GenServer))[],
    unknown
  >;
  public async *start<U extends typeof GenServer>(
    startArgs: [RestartStrategy],
    context: U,
    canceler: Generator<[boolean, EventEmitter], never, boolean>,
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
    const managementCanceler = memo(true);
    const combinedCanceler = combineMemos(
      (...states) => states.reduce((acc, curr) => acc && curr, true),
      managementCanceler,
      canceler
    );
    const combinedCancelerPromise = getMemoPromise(combinedCanceler);
    const childSpecs = yield* this.init();
    await Promise.all([
      tail(
        (specs) =>
          this.run(combinedCanceler, combinedCancelerPromise, context, specs),
        canceler,
        {
          childSpecs,
          strategy: startArgs[0],
        },
        (specs) => specs.childSpecs.length === 0
      ),
      tail(
        () =>
          this.runManagement(
            managementCanceler,
            combinedCancelerPromise,
            context
          ),
        combinedCanceler,
        null,
        (exitValue) => exitValue === undefined
      ),
    ]);
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
    canceler: Generator<[boolean, EventEmitter], never, boolean>,
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
  protected async *runManagement<U extends typeof GenServer>(
    canceler: Generator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>,
    context: U
  ) {
    const event = yield* take<ServerEvent>(
      `${context.name}_management`,
      this[keyForCombinedSelfReadable],
      cancelerPromise
    );
    if (event && event.action === "stop") {
      putMemoValue(canceler, false);
      return true;
    }
  }
  public async *stop() {}
  public async *stopChild(id: string) {}
  public async *childSpec(): AsyncGenerator<void, ChildSpec, unknown> {
    return {
      startArgs: [RestartStrategy.ONE_FOR_ONE],
      restart: ChildRestartStrategy.PERMANENT,
      shutdown: Infinity,
    };
  }
}

export { GenSupervisor };
