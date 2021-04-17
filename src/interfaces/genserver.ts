import { v1 } from "uuid";
import { call, cast, take, takeAny } from "../effects";
import { ServerEvent, ServerReply, ReplyTypes } from "../events/types";
import {
  keyForIdSymbol,
  keyForMapSymbol,
  keyForCombinedSelfReadable,
} from "../utils/symbols";
import { ChildSpec, ChildRestartStrategy } from "../supervision/types";
import { tail } from "../utils";
import { TransportEmitter } from "../transports/interface";
import EventEmitter from "events";
import { PassThrough } from "stream";
import { combineStreams } from "../streams/combine-streams";
import { CombineEmitter } from "../transports/combine-emitter";

abstract class GenServer {
  [keyForIdSymbol]: string = v1();
  static eventEmitter: TransportEmitter;
  static externalEventEmitters: Map<string, TransportEmitter>;
  private [keyForCombinedSelfReadable]: CombineEmitter;
  [key: string]: (...args: any[]) => AsyncGenerator;
  static [keyForMapSymbol]: Map<string, string> = new Map<string, string>();
  protected abstract init(...args: unknown[]): AsyncGenerator;
  public async *start<U extends typeof GenServer>(
    startArgs: any[],
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
      emitter.setStream(this[keyForIdSymbol], stream);
      return stream;
    });
    this[keyForCombinedSelfReadable] = new CombineEmitter(combinableStreams);
    await tail(
      (state: any) => this.run(canceler, cancelerPromise, context, state),
      canceler,
      yield* this.init(...startArgs),
      (state) => state === undefined
    );
  }
  public async *childSpec(): AsyncGenerator<void, ChildSpec, unknown> {
    return {
      restart: ChildRestartStrategy.PERMANENT,
      shutdown: 10_000,
    };
  }
  protected async *run<U extends typeof GenServer>(
    _canceler: AsyncGenerator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>,
    context: U,
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
