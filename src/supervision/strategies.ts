enum RestartStrategy {
  ONE_FOR_ONE,
  ONE_FOR_ALL,
  REST_FOR_ONE,
}
enum ChildRestartStrategy {
  PERMANENT,
  TEMPORARY,
  TRANSIENT,
}

type ChildSpec = {
  startArgs?: Record<string | number | symbol, any>;
  restart: ChildRestartStrategy;
  shutdown?: number;
};

export { RestartStrategy, ChildRestartStrategy, ChildSpec };
