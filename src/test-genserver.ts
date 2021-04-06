import { GenServer } from "./interfaces/genserver";
import { useTransport } from "./mixin/use-transport";
import EventEmitter from "events";
import { keyForIdSymbol, keyForMapSymbol } from "./utils/symbols";
import { v1 } from "uuid";

class ListServer extends useTransport(new EventEmitter()) {
  //// SERVER MODULE
  private async *handlePush(state: any[], data: any) {
    state.push(data);
    return state;
  }

  private async *handlePop(state: any[]) {
    const data = state.pop();
    return [state, data];
  }

  //// SERVER INITIALISATION
  public async *init(startArgs: null) {
    return [];
  }

  //// PUBLIC API
  static API = {
    PUSH: "PUSH",
    POP: "POP",
  };

  //// CLIENT MODULE
  public static async *push(
    serverId: string,
    element: Record<string | number | symbol, any>
  ) {
    return yield* ListServer.cast([ListServer, serverId], "PUSH", element);
  }
  public static async *pop<T extends GenServer>(self: T, serverId: string) {
    return yield* ListServer.call([ListServer, serverId], self, "POP");
  }
}
export { ListServer };
