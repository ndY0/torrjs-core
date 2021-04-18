import "reflect-metadata";
import { GenServer } from "../interfaces/genserver";
import { handle } from "./handle";
import { ReplyTypes } from "../events/types";
import { keyForMetadataMapSymbol } from "../utils/symbols";

class TestGenServer extends GenServer {
  public async *init(startArgs: null) {
    return [];
  }
  @handle("test")
  private async *handleTest(state: any[]) {
    return { type: ReplyTypes.REPLY, newState: state, reply: null };
  }
}

describe("handle", () => {
  it("should add an entry in the embedded map of the instance linking the event to the functionName", () => {
    // const testInstance = new TestGenServer();
    const map: Map<string, string> = Reflect.getOwnMetadata(
      keyForMetadataMapSymbol,
      TestGenServer.prototype
    );
    expect(map.get("test")).toEqual("handleTest");
  });
});
