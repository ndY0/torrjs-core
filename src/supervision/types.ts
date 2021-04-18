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

type ApplicationSpec<T extends typeof GenServer & (new () => GenServer)> = {
  childStrategy: RestartStrategy;
  supervise: T[];
};

export { RestartStrategy, ChildRestartStrategy, ChildSpec, ApplicationSpec };
