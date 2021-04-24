import "reflect-metadata";
import { TransportEmitter } from "../transports/interface";
import { GenServer } from "../interfaces/genserver";
import { keyForMapSymbol, keyForMetadataMapSymbol } from "../utils/symbols";
import { GenApplication } from "../interfaces/genapplication";

function Server(
  transport: TransportEmitter,
  externalTransports?: { [key: string]: TransportEmitter } & {
    internal?: never;
  }
) {
  return <T extends typeof GenServer, U extends typeof GenApplication>(
    constructor: T | U
  ) => {
    const map: Map<string, string> =
      Reflect.getOwnMetadata(keyForMetadataMapSymbol, constructor.prototype) ||
      new Map();
    Reflect.defineProperty(constructor, keyForMapSymbol, {
      configurable: false,
      enumerable: true,
      value: map,
      writable: false,
    });
    const externalTransportsMap: Map<string, TransportEmitter> = new Map();
    if (externalTransports) {
      Object.keys(externalTransports).forEach((key) => {
        externalTransportsMap.set(key, externalTransports[key]);
      });
    }
    Reflect.defineProperty(constructor, "externalEventEmitters", {
      configurable: false,
      enumerable: false,
      value: externalTransportsMap,
      writable: false,
    });
    Reflect.deleteMetadata(keyForMetadataMapSymbol, constructor.prototype);
    Reflect.defineProperty(constructor, "eventEmitter", {
      configurable: false,
      enumerable: false,
      value: transport,
      writable: false,
    });
  };
}

export { Server };
