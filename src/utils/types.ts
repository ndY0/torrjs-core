import { GenServer } from "../interfaces/genserver";
import { Transport } from "../interfaces/transport";
import { TransportEmitter } from "../transports";

type Class<T> = T & { new (...args: unknown[]): T };
type MixedTransportGenServer = typeof GenServer & {
  eventEmitter: TransportEmitter;
};

export { Class, MixedTransportGenServer };
