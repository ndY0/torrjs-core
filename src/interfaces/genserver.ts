import { v1 } from "uuid";
import { call, cast, take } from "../effects";
import EventEmitter from "events";
import { ServerEvent } from "../events";
import { keyForIdSymbol, keyForMapSymbol } from "../utils/symbols";
import { ChildSpec, ChildRestartStrategy } from "../supervision/strategies";
import { tail } from "../utils";

abstract class GenServer {
  [keyForIdSymbol]: string = v1();
  [key: string]: (...args: any[]) => AsyncGenerator;
  [keyForMapSymbol] = new Map<string, string>();
  public abstract init(...args: unknown[]): AsyncGenerator;
  public async *start<U extends typeof GenServer>(
    startArgs: any,
    context: U,
    canceler: AsyncGenerator<boolean, boolean, boolean>
  ) {
    await tail(this.run(yield* this.init(startArgs), context), canceler);
  }
  public async *childSpec(): AsyncGenerator<void, ChildSpec, unknown> {
    return {
      restart: ChildRestartStrategy.PERMANENT,
      shutdown: 10_000,
    };
  }
  public async *run<U extends typeof GenServer>(context: U, state: any) {
    const event = yield* take<ServerEvent>(
      this[keyForIdSymbol],
      context.eventEmitter
    );
    const funcName = this[keyForMapSymbol].get(event.action);
    if (funcName) {
      return yield* this[funcName](event.caller, event.data);
    } else {
      return state;
    }
  }
  static eventEmitter: EventEmitter = new EventEmitter();
  static API: { [key: string]: string } = {};
  static async *call<T, U extends typeof GenServer>(
    [target, serverId]: [typeof GenServer, string],
    self: GenServer,
    action: keyof U["API"],
    args?: Record<string | number | symbol, any>
  ): AsyncGenerator<void, T, unknown> {
    return yield* call<T, void>(async function* (...args: any[]) {
      target.eventEmitter.emit(
        serverId,
        new ServerEvent(<string>action, args, self[keyForIdSymbol])
      );
      return yield* take<T>(self[keyForIdSymbol], target.eventEmitter);
    }, args);
  }
  static *cast<U extends typeof GenServer>(
    [target, serverId]: [typeof GenServer, string],
    action: keyof U["API"],
    args?: Record<string | number | symbol, any>
  ): Generator<null, null, unknown> {
    return yield* cast(async function* (...args: any[]) {
      target.eventEmitter.emit(serverId, new ServerEvent(<string>action, args));
    }, args);
  }
}

export { GenServer };
