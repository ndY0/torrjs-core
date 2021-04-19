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
import {
  keyForCombinedSelfReadable,
  keyForSupervisedChidren,
  keyForIdSymbol,
} from "../utils/symbols";
import { CombineEmitter } from "../transports/combine-emitter";
import { take } from "../effects";
import { ServerEvent } from "../events/types";
import { TransportEmitter } from "../transports/interface";

// TODO : implements application management calls, supervisors, dynsupervisors, application child registration update
abstract class GenSupervisor extends GenServer {
  protected [keyForSupervisedChidren]: {
    id: string | null;
    canceler: Generator<[boolean, EventEmitter], never, boolean>;
  }[];
  protected abstract children(): AsyncGenerator<
    unknown,
    (typeof GenServer & (new () => GenServer))[],
    unknown
  >;
  public async *start<U extends typeof GenServer>(
    startArgs: [RestartStrategy],
    context: U,
    canceler: Generator<[boolean, EventEmitter], never, boolean>,
    _cancelerPromise: Promise<boolean>
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
    this[keyForSupervisedChidren] = childSpecs.map(
      (
        childSpecs: [
          typeof GenServer,
          GenServer,
          ChildSpec,
          Generator<[boolean, EventEmitter], never, boolean>
        ]
      ) => ({
        id:
          childSpecs[1] instanceof GenSupervisor
            ? childSpecs[0].name
            : childSpecs[1][keyForIdSymbol],
        canceler: childSpecs[3],
      })
    );
    await Promise.all([
      tail(
        (specs) =>
          this.run(
            combinedCanceler,
            combinedCancelerPromise,
            context,
            this[keyForSupervisedChidren],
            specs
          ),
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
    const childSpecs: [
      typeof GenServer,
      GenServer,
      ChildSpec,
      Generator<[boolean, EventEmitter], never, boolean>
    ][] = [];
    for (const [Child, child] of children) {
      childSpecs.push([Child, child, yield* child.childSpec(), memo(true)]);
    }
    return childSpecs;
  }
  protected async *run<U extends typeof GenServer>(
    canceler: Generator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>,
    _context: U,
    supervised: {
      id: string | null;
      canceler: Generator<[boolean, EventEmitter], never, boolean>;
    }[],
    {
      strategy,
      childSpecs,
    }: {
      childSpecs: [
        typeof GenServer,
        GenServer,
        ChildSpec,
        Generator<[boolean, EventEmitter], never, boolean>
      ][];
      strategy: RestartStrategy;
    }
  ): AsyncGenerator<
    any,
    {
      childSpecs: [
        typeof GenServer,
        GenServer,
        ChildSpec,
        Generator<[boolean, EventEmitter], never, boolean>
      ][];
      strategy: RestartStrategy;
    },
    undefined
  > {
    return yield* supervise(
      childSpecs,
      strategy,
      canceler,
      cancelerPromise,
      supervised
    );
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
    if (event && event.action === "stopChild") {
      const {
        data: [{ id }],
      } = event;
      const child = this[keyForSupervisedChidren].find(
        (child) => child.id === id
      );
      if (child) {
        putMemoValue(child.canceler, false);
      }
      return true;
    }
    if (event && event.action === "lookup") {
      if (event.caller) {
        (event.transport === "internal"
          ? context.eventEmitter
          : <TransportEmitter>context.externalEventEmitters.get(event.transport)
        ).emit(
          { event: event.caller },
          this[keyForSupervisedChidren]
            .map(({ id }) => id)
            .filter((id) => id !== null)
        );
      }
      return true;
    }
  }
  public async *stopChild<U extends typeof GenSupervisor>(
    targetSupervisor: U,
    id: string,
    transport?: string
  ) {
    return yield* GenServer.cast<U>(
      [targetSupervisor, `${targetSupervisor.name}_management`, transport],
      "stopChild",
      { id }
    );
  }
  public async *lookup<U extends typeof GenSupervisor, V extends GenServer>(
    targetSupervisor: U,
    self: V,
    transport?: string
  ) {
    return yield* GenServer.call<{ id: string }[], U, V, string>(
      [targetSupervisor, `${targetSupervisor.name}_management`, transport],
      self,
      "lookup",
      {}
    );
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
