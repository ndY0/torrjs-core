import { GenServer } from "./interfaces/genserver";

class ListServer extends GenServer {
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
    return yield* GenServer.cast<typeof ListServer>(
      [ListServer, serverId],
      "PUSH",
      element
    );
  }
  public static async *pop(self: GenServer, serverId: string) {
    return yield* GenServer.call<any, typeof ListServer>(
      [ListServer, serverId],
      self,
      "POP"
    );
  }
}
export { ListServer };
