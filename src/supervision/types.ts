import { GenServer } from "../interfaces/genserver";

enum RestartStrategy {
  ONE_FOR_ONE,
  ONE_FOR_ALL,
}
enum ChildRestartStrategy {
  PERMANENT,
  TEMPORARY,
  TRANSIENT,
}

type ChildSpec = {
  startArgs?: any[];
  restart: ChildRestartStrategy;
  shutdown?: number;
};

type ApplicationSpec = {
  childStrategy: RestartStrategy;
  supervise: typeof GenServer[];
};

export { RestartStrategy, ChildRestartStrategy, ChildSpec, ApplicationSpec };
