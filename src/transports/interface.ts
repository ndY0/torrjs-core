import EventEmitter from "events";
import { Duplex, Stream } from "stream";
import { Class } from "../utils/types";

interface TransportEmitter {
  once(
    onceInfo: {
      timeout?: number;
      event: string | symbol;
      canceler: AsyncGenerator<[boolean, EventEmitter], never, boolean>;
    },
    listener: (...args: any[]) => void
  ): Promise<void>;
  emit(
    emitInfo: { timeout?: number; event: string | symbol },
    ...args: any[]
  ): Promise<boolean>;
  resetInternalStreams(): void;
  setStream(key: string, stream: Duplex): void;
  getStream(key: string): Duplex | undefined;
  getInternalStreamType(): Class<any>;
}

export { TransportEmitter };
