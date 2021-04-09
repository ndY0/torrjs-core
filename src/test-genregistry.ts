import { GenRegistry } from "./interfaces/genregistry";
import { Server } from "./annotations/server";
import { InMemoryEmitter } from "./transports/in-memory-emitter";
import { GenServer } from "./interfaces/genserver";
import { keyForIdSymbol } from "./utils/symbols";
import { ListServer } from "./test-genserver";

@Server(new InMemoryEmitter(1000))
class ListRegistry extends GenRegistry {
  public static async *lookupList<U extends GenServer>(
    self: U,
    selector: string
  ) {
    return yield* GenRegistry.lookup(ListRegistry, self, selector);
  }
  public static async *registerList(key: string, server: ListServer) {
    yield* GenRegistry.register(ListRegistry, key, server[keyForIdSymbol]);
  }
}

export { ListRegistry };
