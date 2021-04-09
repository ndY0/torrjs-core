import { GenSupervisor } from "./interfaces/gensupervisor";
import { ListServer } from "./test-genserver";
import { Server } from "./annotations/server";
import { InMemoryEmitter } from "./transports/in-memory-emitter";
import { ListRegistry } from "./test-genregistry";

@Server(new InMemoryEmitter(100))
class ListRegistrySupervisor extends GenSupervisor {
  protected async *children() {
    return [ListRegistry];
  }
}

export { ListRegistrySupervisor };
