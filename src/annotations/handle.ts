import "reflect-metadata";
import { GenServer } from "../interfaces/genserver";
import { keyForMetadataMapSymbol } from "../utils/symbols";

function handle<V extends typeof GenServer>(eventName: keyof V["API"]) {
  return <T extends GenServer, U extends string>(
    target: T,
    propertyKey: U & (U extends "init" ? never : U),
    _descriptor: PropertyDescriptor
  ) => {
    let map: Map<string, string> =
      Reflect.getOwnMetadata(keyForMetadataMapSymbol, target) ||
      new Map<string, string>();
    map.set(<string>eventName, propertyKey);
    Reflect.defineMetadata(keyForMetadataMapSymbol, map, target);
  };
}

export { handle };
