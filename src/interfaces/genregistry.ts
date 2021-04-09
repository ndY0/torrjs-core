import { GenServer } from "./genserver";
import EventEmitter from "events";
import { take } from "../effects";
import { RegistryAction, ServerEvent } from "../events/types";

abstract class GenRegistry extends GenServer {
  protected async *init() {
    return new Map<string, string[]>();
  }
  protected async *run<U extends typeof GenServer>(
    _canceler: AsyncGenerator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>,
    context: U,
    state: Map<string, string[]>
  ) {
    const { data, caller, action } = yield* take<ServerEvent<RegistryAction>>(
      context.name,
      context.eventEmitter,
      cancelerPromise
    );
    if (action === "register") {
      const { key, value } = <{ key: string; value: string }>data;
      const mapValue = state.get(key);
      if (!mapValue) {
        state.set(key, [value]);
      } else {
        state.set(key, [...mapValue, value]);
      }
    } else {
      const { selector } = <{ selector: string }>data;
      if (caller) {
        context.eventEmitter.emit({ event: caller }, state.get(selector) || []);
      }
    }
    return state;
  }
  public static async *lookup<
    U extends typeof GenRegistry,
    V extends GenServer
  >(targetRegistry: U, self: V, selector: string, timeout?: number) {
    return yield* GenServer.call<string, U, V>(
      [targetRegistry, targetRegistry.name],
      self,
      "lookup",
      { selector },
      timeout
    );
  }
  public static async *register<U extends typeof GenRegistry>(
    targetRegistry: U,
    key: string,
    value: string
  ) {
    yield* GenServer.cast<U>(
      [targetRegistry, targetRegistry.name],
      "register",
      { key, value }
    );
  }
}

export { GenRegistry };