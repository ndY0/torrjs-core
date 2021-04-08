import { v1 } from "uuid";
import { call, cast, take } from "../effects";
import { ServerEvent, ServerReply, ReplyTypes } from "../events";
import { keyForIdSymbol, keyForMapSymbol } from "../utils/symbols";
import { ChildSpec, ChildRestartStrategy } from "../supervision/strategies";
import { tail } from "../utils";
import { TransportEmitter } from "../transports";
import EventEmitter from "events";
import { Server } from "http";

abstract class GenServer {
  [keyForIdSymbol]: string = v1();
  static eventEmitter: TransportEmitter;
  [key: string]: (...args: any[]) => AsyncGenerator;
  static [keyForMapSymbol]: Map<string, string> = new Map<string, string>();
  public abstract init(...args: unknown[]): AsyncGenerator;
  public async *start<U extends typeof GenServer>(
    startArgs: any,
    context: U,
    canceler: AsyncGenerator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>
  ) {
    await tail(
      this.run(canceler, cancelerPromise, context, yield* this.init(startArgs)),
      canceler
    );
  }
  public async *childSpec(): AsyncGenerator<void, ChildSpec, unknown> {
    return {
      restart: ChildRestartStrategy.PERMANENT,
      shutdown: 10_000,
    };
  }
  public async *run<U extends typeof GenServer>(
    _canceler: AsyncGenerator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>,
    context: U,
    state: any
  ) {
    const event = yield* take<ServerEvent>(
      this[keyForIdSymbol],
      context.eventEmitter,
      cancelerPromise
    );
    const funcName = context[keyForMapSymbol].get(event.action);
    let result: ServerReply;
    if (funcName) {
      result = yield* this[funcName](state, event.data);
    } else {
      return state;
    }
    if (event.caller && result.type === ReplyTypes.REPLY) {
      context.eventEmitter.emit(event.caller, result.reply);
    }
    return result.newState;
  }
  static API: { [key: string]: string } = {};
  static async *call<T, U extends typeof GenServer, V extends GenServer>(
    [target, serverId]: [U, string],
    self: V,
    action: keyof U["API"],
    args?: Record<string | number | symbol, any>,
    timeout: number = 5000
  ): AsyncGenerator<void, T, unknown> {
    return yield* call<T, void>(async function* (...args: any[]) {
      target.eventEmitter.emit(
        serverId,
        new ServerEvent(<string>action, args, self[keyForIdSymbol])
      );
      return yield* take<T>(self[keyForIdSymbol], target.eventEmitter, timeout);
    }, args);
  }
  static *cast<U extends typeof GenServer>(
    [target, serverId]: [U, string],
    action: keyof U["API"],
    args?: Record<string | number | symbol, any>
  ): Generator<null, null, unknown> {
    return yield* cast(async function* (...args: any[]) {
      target.eventEmitter.emit(serverId, new ServerEvent(<string>action, args));
    }, args);
  }
}

export { GenServer };
