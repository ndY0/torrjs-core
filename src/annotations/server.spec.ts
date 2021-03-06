import { GenServer } from "../interfaces/genserver";
import { handle } from "./handle";
import { ReplyTypes } from "../events/types";
import { Server } from "./server";
import { InMemoryEmitter } from "../transports/in-memory-emitter";
import { keyForMapSymbol, keyForMetadataMapSymbol } from "../utils/symbols";

@Server(new InMemoryEmitter(10))
class TestGenServer extends GenServer {
  public async *init(startArgs: null) {
    return [];
  }
  @handle("test")
  private async *handleTest(state: any[]) {
    return { type: ReplyTypes.REPLY, newState: state, reply: null };
  }
}

@Server(new InMemoryEmitter(10), { test: new InMemoryEmitter(10) })
class TestGenServerExternal extends GenServer {
  public async *init(startArgs: null) {
    return [];
  }
  @handle("test")
  private async *handleTest(state: any[]) {
    return { type: ReplyTypes.REPLY, newState: state, reply: null };
  }
}

@Server(new InMemoryEmitter(10))
class TestGenServerEmpty extends GenServer {
  public async *init(startArgs: null) {
    return [];
  }
  private async *handleTest(state: any[]) {
    return { type: ReplyTypes.REPLY, newState: state, reply: null };
  }
}

describe("Server", () => {
  it(`should attach to the class object the provided emitter, fill
  the mapping information of event provided by handle annotations,
  and delete the map set for initializing metadatas about events`, () => {
    const map:
      | PropertyDescriptor
      | undefined = Reflect.getOwnPropertyDescriptor(
      TestGenServer,
      keyForMapSymbol
    );
    const mapMetadata: Map<string, string> = Reflect.getOwnMetadata(
      keyForMetadataMapSymbol,
      TestGenServer.prototype
    );
    const eventEmitter:
      | PropertyDescriptor
      | undefined = Reflect.getOwnPropertyDescriptor(
      TestGenServer,
      "eventEmitter"
    );
    expect(map?.value.get("test")).toEqual("handleTest");
    expect(mapMetadata).toBeUndefined();
    expect(eventEmitter?.value).toBeInstanceOf(InMemoryEmitter);
  });
  it(`should attach to the class object the provided emitter, fill
  the mapping information of event with an empty map if no provided by handle,
  and delete the map set for initializing metadatas about events`, () => {
    const map:
      | PropertyDescriptor
      | undefined = Reflect.getOwnPropertyDescriptor(
      TestGenServerEmpty,
      keyForMapSymbol
    );

    const mapMetadata: Map<string, string> = Reflect.getOwnMetadata(
      keyForMetadataMapSymbol,
      TestGenServerEmpty.prototype
    );
    const eventEmitter:
      | PropertyDescriptor
      | undefined = Reflect.getOwnPropertyDescriptor(
      TestGenServerEmpty,
      "eventEmitter"
    );
    expect(map?.value.size).toEqual(0);
    expect(mapMetadata).toBeUndefined();
    expect(eventEmitter?.value).toBeInstanceOf(InMemoryEmitter);
  });
  it(`should attach to the class object the provided external emitters`, () => {
    const externalEventEmitters:
      | PropertyDescriptor
      | undefined = Reflect.getOwnPropertyDescriptor(
      TestGenServerExternal,
      "externalEventEmitters"
    );
    TestGenServerExternal;
    expect(externalEventEmitters?.value.size).toEqual(1);
    expect(externalEventEmitters?.value.get("test")).toBeInstanceOf(
      InMemoryEmitter
    );
  });
});
