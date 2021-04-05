import { ChildSpec, RestartStrategy, ChildRestartStrategy } from "./strategies";
import { GenServer } from "../interfaces/genserver";
import { tail, loopPromise } from "../utils";

async function* supervise(
  children: [GenServer, ChildSpec][],
  strategy: RestartStrategy
) {
  while (true) {
    for (const generator of children.map(([child, spec]) => child.init(spec))) {
      tail(generator).
    }
  }

  const executors = childs.map(
    ([server, spec]) => async ([passServer, passSpec]: [
      GenServer,
      ChildSpec
    ]) => {
      try {
        await tail(passServer.init(passSpec.startArgs));
        if (passSpec.restart === ChildRestartStrategy.PERMANENT) {
          return [passServer, passSpec];
        }
      } catch (e) {
        if (passSpec.restart === ChildRestartStrategy.TRANSIENT) {
          return [passServer, passSpec];
        }
      } finally {
        return false;
      }
    }
  );
  if (strategy === RestartStrategy.ONE_FOR_ALL) {
    loopPromise(async (children: [GenServer, ChildSpec][]) => {
      try {
        const result = await Promise.any(
          executors.map((executor, index) => executor(children[index]))
        );
        return;
      } catch (e) {}
    }, childs);
  } else if (strategy === RestartStrategy.REST_FOR_ONE) {
  }
}

export { supervise };
