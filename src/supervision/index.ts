import { ChildSpec, RestartStrategy, ChildRestartStrategy } from "./strategies";
import { GenServer } from "../interfaces/genserver";
import { tail, memo, getMemoPromise } from "../utils";
import { Class } from "../utils/types";

async function* supervise(
  children: [typeof GenServer, GenServer, ChildSpec][],
  strategy: RestartStrategy,
  upperCancelerPromise: Promise<boolean>
) {
  const canceler = memo(true);
  const cancelerPromise = getMemoPromise(canceler);
  Promise.any(
    children.map(([Child, child, spec]) =>
      tail(
        child.start(
          spec.startArgs,
          Child,
          canceler,
          Promise.any([upperCancelerPromise, cancelerPromise])
        ),
        canceler
      )
    )
  );
}

export { supervise };
