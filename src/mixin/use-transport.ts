import { GenServer } from "../interfaces/genserver";
import { TransportEmitter } from "../transports";
import { keyForIdSymbol, keyForMapSymbol } from "../utils/symbols";
import { Transport } from "../interfaces/transport";
import { v1 } from "uuid";
import EventEmitter from "events";
import { MixedTransportGenServer } from "../utils/types";

const useTransport = <T extends TransportEmitter>(
  transport: T,
  Base: typeof GenServer = GenServer,
  keyForId: Symbol = keyForIdSymbol,
  keyForMap: Symbol = keyForMapSymbol
) => {
  return class MixedTransportGenServer extends Base {
    static eventEmitter = transport;
    [keyForIdSymbol]: string = v1();
    [keyForMapSymbol]: Map<string, string> = new Map<string, string>();
    public init(...args: unknown[]): AsyncGenerator<unknown, any, unknown> {
      throw new Error("Method not implemented.");
    }
  };
};

export { useTransport };
