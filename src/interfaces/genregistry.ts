import { GenServer } from "./genserver";
import EventEmitter from "events";
import { take } from "../effects";
import { RegistryAction, ServerEvent } from "../events/types";
import {
  keyForCombinedSelfReadable,
  keyForCombinedAdministrationSelfReadable,
} from "../utils/symbols";
import { CombineEmitter } from "../transports/combine-emitter";
import {
  tail,
  getMemoPromise,
  combineMemos,
  memo,
  putMemoValue,
} from "../utils";
import { TransportEmitter } from "../transports/interface";

abstract class GenRegistry extends GenServer {
  protected async *init() {
    return new Map<string, string[]>();
  }
  public async *start<U extends typeof GenServer>(
    _startArgs: any,
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
    const combinableAdministrationStreams = [
      context.eventEmitter,
      ...context.externalEventEmitters.values(),
    ].map((emitter) => {
      const administrationStream = new (emitter.getInternalStreamType())();
      emitter.setStream(`${context.name}_management`, administrationStream);
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
        yield* this.init(),
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
  protected async *run<U extends typeof GenServer>(
    _canceler: Generator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>,
    context: U,
    _supervised: {
      id: string | null;
      canceler: Generator<[boolean, EventEmitter], never, boolean>;
    }[],
    state: Map<string, string[]>
  ) {
    const res = yield* take<ServerEvent<RegistryAction>>(
      context.name,
      this[keyForCombinedSelfReadable],
      cancelerPromise
    );
    if (res) {
      const {
        data: [data],
        transport,
        caller,
        action,
      } = res;
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
        (transport === "internal"
          ? context.eventEmitter
          : <TransportEmitter>context.externalEventEmitters.get(transport)
        ).emit({ event: <string>caller }, state.get(selector) || []);
      }
      return state;
    }
    return undefined;
  }
  protected async *runManagement<U extends typeof GenServer>(
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
  }
  public static async *lookup<
    U extends typeof GenRegistry,
    V extends GenServer,
    W extends string = string
  >(
    [targetRegistry, transport]:
      | [U]
      | [U, (W & (W extends "internal" ? never : W)) | undefined],
    self: V,
    selector: string,
    timeout?: number
  ) {
    return yield* GenServer.call<string, U, V>(
      [targetRegistry, targetRegistry.name, transport],
      self,
      "lookup",
      { selector },
      timeout
    );
  }
  public static async *register<
    U extends typeof GenRegistry,
    V extends string = string
  >(
    [targetRegistry, transport]:
      | [U]
      | [U, (V & (V extends "internal" ? never : V)) | undefined],
    key: string,
    value: string
  ) {
    yield* GenServer.cast<U>(
      [targetRegistry, targetRegistry.name, transport],
      "register",
      { key, value }
    );
  }
}

export { GenRegistry };
