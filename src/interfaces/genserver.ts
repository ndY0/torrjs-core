import { v1 } from "uuid";
import { call, cast, take } from "../effects";
import { ServerEvent, ServerReply, ReplyTypes } from "../events/types";
import {
  keyForIdSymbol,
  keyForMapSymbol,
  keyForCombinedSelfReadable,
  keyForCombinedAdministrationSelfReadable,
} from "../utils/symbols";
import { ChildSpec, ChildRestartStrategy } from "../supervision/types";
import {
  tail,
  memo,
  combineMemos,
  getMemoPromise,
  putMemoValue,
} from "../utils";
import { TransportEmitter } from "../transports/interface";
import EventEmitter from "events";
import { CombineEmitter } from "../transports/combine-emitter";

abstract class GenServer {
  [keyForIdSymbol]: string = v1();
  static eventEmitter: TransportEmitter;
  static externalEventEmitters: Map<string, TransportEmitter>;
  protected [keyForCombinedSelfReadable]: CombineEmitter;
  protected [keyForCombinedAdministrationSelfReadable]: CombineEmitter;
  [key: string]: (...args: any[]) => AsyncGenerator;
  static [keyForMapSymbol]: Map<string, string> = new Map<string, string>();
  protected abstract init(...args: unknown[]): AsyncGenerator;
  public async *start<U extends typeof GenServer>(
    startArgs: any[],
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
      emitter.setStream(this[keyForIdSymbol], stream);
      return stream;
    });
    const combinableAdministrationStreams = [
      context.eventEmitter,
      ...context.externalEventEmitters.values(),
    ].map((emitter) => {
      const administrationStream = new (emitter.getInternalStreamType())();
      emitter.setStream(
        `${this[keyForIdSymbol]}_management`,
        administrationStream
      );
      return administrationStream;
    });
    this[keyForCombinedSelfReadable] = new CombineEmitter(combinableStreams);
    this[keyForCombinedAdministrationSelfReadable] = new CombineEmitter(
      combinableAdministrationStreams
    );
    const managementCanceler = memo(true);
    const combinedCanceler = combineMemos(
      (...states) => states.reduce((acc, curr) => acc && curr, true),
      managementCanceler,
      canceler
    );
    const combinedCancelerPromise = getMemoPromise(combinedCanceler);
    await Promise.all([
      tail(
        (state: any) =>
          this.run(
            combinedCanceler,
            combinedCancelerPromise,
            context,
            [],
            state
          ),
        canceler,
        yield* this.init(...startArgs),
        (state) => state === undefined
      ).then((value) => (putMemoValue(combinedCanceler, false), value)),
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
  public async *childSpec(): AsyncGenerator<void, ChildSpec, unknown> {
    return {
      restart: ChildRestartStrategy.PERMANENT,
      shutdown: 10_000,
    };
  }
  protected async *run<U extends typeof GenServer>(
    _canceler: Generator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>,
    context: U,
    supervised: {
      id: string | null;
      canceler: Generator<[boolean, EventEmitter], never, boolean>;
    }[],
    state: any
  ) {
    const event = yield* take<ServerEvent>(
      this[keyForIdSymbol],
      this[keyForCombinedSelfReadable],
      cancelerPromise
    );
    if (event) {
      const funcName = context[keyForMapSymbol].get(event.action);
      let result: ServerReply;
      if (funcName) {
        result = yield* this[funcName](state, ...event.data);
      } else {
        return state;
      }
      if (event.caller && result.type === ReplyTypes.REPLY) {
        (event.transport === "internal"
          ? context.eventEmitter
          : <TransportEmitter>context.externalEventEmitters.get(event.transport)
        ).emit({ event: event.caller }, result.reply);
      }
      return result.newState;
    }
    return undefined;
  }
  protected async *runManagement<U extends typeof GenServer>(
    canceler: Generator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>,
    _context: U
  ) {
    const event = yield* take<ServerEvent>(
      `${this[keyForIdSymbol]}_management`,
      this[keyForCombinedAdministrationSelfReadable],
      cancelerPromise
    );
    if (event && event.action === "stop") {
      putMemoValue(canceler, false);
      return true;
    }
  }
  public static async *stop<U extends typeof GenServer>(
    target: U,
    targetId: string,
    transport?: string
  ) {
    return yield* GenServer.cast<U>(
      [target, `${targetId}_management`, transport],
      "stop",
      {}
    );
  }
  static API: { [key: string]: string } = {};
  static EXTERNAL_EMITTERS_KEYS: Record<string, string> = {};
  static async *call<
    T,
    U extends typeof GenServer,
    V extends GenServer,
    W extends string = string
  >(
    [target, serverId, transport]:
      | [U, string]
      | [U, string, (W & (W extends "internal" ? never : W)) | undefined],
    self: V,
    action: keyof U["API"],
    args?: Record<string | number | symbol, any>,
    timeout: number = 5000
  ): AsyncGenerator<void, T, unknown> {
    return yield* call<T, void>(async function* (...args: any[]) {
      await (transport
        ? <TransportEmitter>target.externalEventEmitters.get(<string>transport)
        : target.eventEmitter
      ).emit(
        { event: serverId },
        new ServerEvent(
          <string>action,
          transport || "internal",
          args,
          self[keyForIdSymbol]
        )
      );
      return yield* take<T>(
        self[keyForIdSymbol],
        transport
          ? <TransportEmitter>(
              target.externalEventEmitters.get(<string>transport)
            )
          : target.eventEmitter,
        timeout
      );
    }, args);
  }
  static *cast<U extends typeof GenServer, V extends string = string>(
    [target, serverId, transport]:
      | [U, string]
      | [U, string, (V & (V extends "internal" ? never : V)) | undefined],
    action: keyof U["API"],
    args?: Record<string | number | symbol, any>
  ): Generator<null, null, unknown> {
    return yield* cast(async function* (...args: any[]) {
      (transport
        ? <TransportEmitter>target.externalEventEmitters.get(<string>transport)
        : target.eventEmitter
      ).emit(
        { event: serverId },
        new ServerEvent(<string>action, transport || "internal", args)
      );
    }, args);
  }
}

export { GenServer };
