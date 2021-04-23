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
  putMemoValue,
  promisifyGenerator,
} from "../utils";
import { supervise } from "../supervision";
import EventEmitter from "events";
import {
  keyForSupervisedChidren,
  keyForIdSymbol,
  keyForCombinedAdministrationSelfReadable,
} from "../utils/symbols";
import { GenSupervisor } from "./gensupervisor";
import { TransportEmitter } from "../transports/interface";
import { take } from "../effects";
import { ServerEvent } from "../events/types";
import { CombineEmitter } from "../transports/combine-emitter";

abstract class GenApplication {
  static eventEmitter: TransportEmitter;
  static externalEventEmitters: Map<string, TransportEmitter>;
  private canceler: Generator<[boolean, EventEmitter], never, boolean>;
  private cancelerPromise: Promise<boolean>;
  protected [keyForCombinedAdministrationSelfReadable]: CombineEmitter;
  private [keyForSupervisedChidren]: {
    id: string | null;
    canceler: Generator<[boolean, EventEmitter], never, boolean>;
  }[];
  public constructor(private readonly spec: ApplicationSpec) {
    this.canceler = memo(true);
    this.cancelerPromise = getMemoPromise(this.canceler);
  }
  public async start<U extends typeof GenApplication>(context: U) {
    /**
     * this is needed in order to keep event loop from exiting if all workers are awaiting in the take event state
     * (no execution would be scheduled otherwise)
     */
    const timeout = setInterval(
      /* istanbul ignore next */ () => {},
      Math.pow(2, 32) / 2 - 1
    );
    [
      context.eventEmitter,
      ...context.externalEventEmitters.values(),
    ].forEach((emitter) => emitter.resetInternalStreams());
    const combinableAdministrationStreams = [
      context.eventEmitter,
      ...context.externalEventEmitters.values(),
    ].map((emitter) => {
      const administrationStream = new (emitter.getInternalStreamType())();
      emitter.setStream(`${context.name}_management`, administrationStream);
      return administrationStream;
    });
    this[keyForCombinedAdministrationSelfReadable] = new CombineEmitter(
      combinableAdministrationStreams
    );
    const childSpecs = await promisifyAsyncGenerator(this.init());
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
            this.canceler,
            this.cancelerPromise,
            this[keyForSupervisedChidren],
            specs
          ),
        this.canceler,
        {
          childSpecs,
          strategy: this.spec.childStrategy,
        },
        (specs) => specs.childSpecs.length === 0
      ),
      tail(
        () => this.runManagement(this.canceler, this.cancelerPromise, context),
        this.canceler,
        null,
        (exitValue) => exitValue === undefined
      ),
    ]);
    clearInterval(timeout);
  }
  private async *init(): AsyncGenerator {
    const children: [
      typeof GenServer,
      GenServer
    ][] = this.spec.supervise.map((Child) => [Child, new (<any>Child)()]);
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
  private async *run(
    canceler: Generator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>,
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
  protected async *runManagement<U extends typeof GenApplication>(
    canceler: Generator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>,
    context: U
  ) {
    const event = yield* take<ServerEvent>(
      `${context.name}_management`,
      this[keyForCombinedAdministrationSelfReadable],
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
    if (event && event.caller && event.action === "lookup") {
      (event.transport === "internal"
        ? context.eventEmitter
        : <TransportEmitter>context.externalEventEmitters.get(event.transport)
      ).emit(
        { event: event.caller },
        this[keyForSupervisedChidren]
          .map(({ id }) => id)
          .filter((id) => id !== null)
      );
      return true;
    }
    return true;
  }
  public static async stop<U extends typeof GenApplication>(
    target: U,
    transport?: string
  ) {
    return promisifyGenerator(
      GenServer.cast<typeof GenServer>(
        [
          <typeof GenServer>(<unknown>target),
          `${target.name}_management`,
          transport,
        ],
        "stop",
        {}
      )
    );
  }
  public static async stopChild<U extends typeof GenApplication>(
    targetApplication: U,
    id: string,
    transport?: string
  ) {
    return await promisifyGenerator(
      GenServer.cast<typeof GenServer>(
        [
          <typeof GenServer>(<unknown>targetApplication),
          `${targetApplication.name}_management`,
          transport,
        ],
        "stopChild",
        { id }
      )
    );
  }
  public static async lookup<
    U extends typeof GenApplication,
    V extends GenServer
  >(targetSupervisor: U, self: V, transport?: string) {
    return await promisifyAsyncGenerator<string[]>(
      GenServer.call<string[], typeof GenServer, GenServer, string>(
        [
          <typeof GenServer>(<unknown>targetSupervisor),
          `${targetSupervisor.name}_management`,
          transport,
        ],
        self,
        "lookup",
        {}
      )
    );
  }
}

export { GenApplication };
