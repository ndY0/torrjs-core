import "reflect-metadata";
import { TransportEmitter } from "../transports/interface";
import { GenServer } from "../interfaces/genserver";
import { keyForMapSymbol, keyForMetadataMapSymbol } from "../utils/symbols";

function Server(transport: TransportEmitter) {
  return <T extends typeof GenServer>(constructor: T) => {
    const map: Map<string, string> =
      Reflect.getOwnMetadata(keyForMetadataMapSymbol, constructor.prototype) ||
      new Map();
    Reflect.defineProperty(constructor, keyForMapSymbol, {
      configurable: false,
      enumerable: true,
      value: map,
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