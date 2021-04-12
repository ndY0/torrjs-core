import EventEmitter from "events";
import { Duplex } from "stream";

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
}

export { TransportEmitter };
