import { ChildSpec, RestartStrategy, ChildRestartStrategy } from "./strategies";
import { GenServer } from "../interfaces/genserver";
import { tail, loopPromise } from "../utils";

async function* supervise(
  children: [GenServer, ChildSpec][],
  strategy: RestartStrategy
) {}

export { supervise };
