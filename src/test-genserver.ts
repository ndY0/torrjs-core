import { GenServer } from "./interfaces/genserver";
import EventEmitter from "events";
import { Server } from "./annotations/server";
import { handle } from "./annotations/handle";

@Server(new EventEmitter())
class ListServer extends GenServer {
  //// SERVER MODULE
  @handle("push")
  private async *handlePush(state: any[], data: any) {
    state.push(data);
    return state;
  }

  @handle("pop")
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
