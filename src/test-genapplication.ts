import { GenApplication } from "./interfaces/genapplication";
import { ListRegistrySupervisor } from "./test-gensupervisor";
import { ListDynamicSupervisor } from "./test-gendynamicsupervisor";
import { RestartStrategy, ChildRestartStrategy } from "./supervision/types";

const listApp = new GenApplication({
  childStrategy: RestartStrategy.ONE_FOR_ONE,
  strategy: {
    restart: ChildRestartStrategy.PERMANENT,
    shutdown: 10_000,
  },
  supervise: [ListRegistrySupervisor, ListDynamicSupervisor],
});

export { listApp };
