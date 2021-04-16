import { TransportEmitter } from "./interface";
import { Duplex, EventEmitter } from "stream";
import { InMemoryDuplex } from "../streams/in-memory-duplex";
import {
  memo,
  getMemoValue,
  putMemoValue,
  promisify,
  cure,
  delay,
} from "../utils";

class InMemoryEmitter implements TransportEmitter {
  private streams: Map<string | symbol, Duplex> = new Map<
    string | symbol,
    Duplex
  >();
  public constructor(private readonly queueSize: number) {}
  getInternalStreamType() {
    return InMemoryDuplex;
  }
  resetInternalStreams(): void {
    this.streams = new Map();
  }
  setStream(key: string, stream: Duplex): void {
    this.streams.set(key, stream);
  }
  getStream(key: string): Duplex | undefined {
    return this.streams.get(key);
  }
  public async once(
    {
      timeout,
      event,
      canceler,
    }: {
      timeout?: number | Promise<boolean>;
      event: string | symbol;
      canceler: AsyncGenerator<[boolean, EventEmitter], never, boolean>;
    },
    listener: (...args: any[]) => void
  ): Promise<void> {
    let stream = this.streams.get(event);
    if (!stream) {
      stream = new InMemoryDuplex(this.queueSize);
      this.streams.set(event, stream);
    }
    const innerCanceler = memo(true);
    let result = stream.read(1);
    if (!result) {
      result = await Promise.race([
        (async function (passedCanceler, outterCanceler) {
          await promisify(cure(stream.once, stream)("readable"), stream);
          const shouldRun = (
            await Promise.all([
              getMemoValue(passedCanceler),
              getMemoValue(outterCanceler),
            ])
          ).reduce((acc, curr) => acc && curr, true);
          if (shouldRun) {
            return (<Duplex>stream).read(1);
          }
        })(innerCanceler, canceler),
        (async function (passedCanceler) {
          if (typeof timeout === "number" || timeout === undefined) {
            await delay(timeout || 10_000);
          } else {
            await timeout;
          }
          await putMemoValue(passedCanceler, false);
        })(innerCanceler),
      ]);
    }
    if (result && typeof result !== "boolean") {
      listener(...result);
    } else {
      listener();
    }
  }
  public async emit(
    { timeout, event }: { timeout?: number; event: string | symbol },
    ...args: any[]
  ): Promise<boolean> {
    let stream = this.streams.get(event);
    if (!stream) {
      stream = new InMemoryDuplex(this.queueSize);
      this.streams.set(event, stream);
    }
    const ok = stream.write(args);
    if (!ok) {
      return await Promise.race([
        (async () => {
          await promisify(cure(stream.once, stream)("drain"), stream);
          (<Duplex>stream).write(args);
          return true;
        })(),
        (async () => {
          await delay(timeout || 5_000);
          return false;
        })(),
      ]);
    }
    return true;
  }
}

export { InMemoryEmitter };
