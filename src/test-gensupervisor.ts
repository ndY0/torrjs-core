import { GenSupervisor } from "./interfaces/gensupervisor";
import { ListServer } from "./test-genserver";
import { Server } from "./annotations/server";
import EventEmitter from "events";

@Server(new EventEmitter())
class ListSupervisor extends GenSupervisor {
  protected async *children() {
    return [ListServer, ListServer];
  }
}

export { ListSupervisor };
