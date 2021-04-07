import "reflect-metadata";
import { GenServer } from "../interfaces/genserver";
import { ListServer } from "../test-genserver";
import { Class } from "../utils/types";
import { keyForMetadataMapSymbol } from "../utils/symbols";

type Reserved = "init";
type Not<T> = T extends Reserved ? never : T;

function handle(eventName: string) {
  return <T extends GenServer, U extends string>(
    target: T,
    propertyKey: U & (U extends Reserved ? never : U),
    _descriptor: PropertyDescriptor
  ) => {
    let map: Map<string, string> = Reflect.getOwnMetadata(
      keyForMetadataMapSymbol,
      target
    );
    if (!map) {
      map = new Map<string, string>();
    }
    map.set(eventName, propertyKey);
    Reflect.defineMetadata(keyForMetadataMapSymbol, map, target);
  };
}

export { handle };
