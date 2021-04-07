import { GenSupervisor } from "./interfaces/gensupervisor";
import { GenServer } from "./interfaces/genserver";
import { ListServer } from "./test-genserver";
import { Class } from "./utils/types";

class ListSupervisor extends GenSupervisor {
  protected children<ListServer>() {
    return [ListServer];
  }
}
