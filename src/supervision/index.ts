import { ChildSpec, RestartStrategy, ChildRestartStrategy } from "./strategies";
import { GenServer } from "../interfaces/genserver";
import { tail, memo } from "../utils";
import { Class } from "../utils/types";

async function* supervise(
  children: [Class<GenServer>, GenServer, ChildSpec][],
  strategy: RestartStrategy
) {
  const canceler = memo(true);
  Promise.any(
    children.map(([Child, child, spec]) =>
      tail(child.start(spec.startArgs, Child), canceler)
    )
  );
}

export { supervise };
