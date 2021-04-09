import { GenDynamicSupervisor } from "./interfaces/gendynamicsupervisor";
import { ListServer } from "./test-genserver";
import { ChildRestartStrategy } from "./supervision/types";
import { InMemoryEmitter } from "./transports/in-memory-emitter";
import { Server } from "./annotations/server";

@Server(new InMemoryEmitter(100))
class ListDynamicSupervisor extends GenDynamicSupervisor {
  public static async *startChild() {
    yield* GenDynamicSupervisor.startChild(ListDynamicSupervisor, ListServer, {
      restart: ChildRestartStrategy.PERMANENT,
    });
  }
}

export { ListDynamicSupervisor };
