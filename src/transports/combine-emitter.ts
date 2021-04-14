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
import { MultiplexReadable, combineStreams } from "../streams/combine-streams";

class CombineEmitter implements TransportEmitter {
  private stream: Duplex;
  constructor(streams: Duplex[]) {
    this.stream = combineStreams(streams);
  }
  getInternalStreamType() {
    return MultiplexReadable;
  }
  resetInternalStreams(): void {
    throw new Error("this stream shouldn't be reseted");
  }
  setStream(_key: string, stream: Duplex): void {
    this.stream = stream;
  }
  getStream(_key: string): Duplex | undefined {
    return this.stream;
  }
  public async once(
    {
      timeout,
      event,
      canceler,
    }: {
      timeout?: number;
      event: string | symbol;
      canceler: AsyncGenerator<[boolean, EventEmitter], never, boolean>;
    },
    listener: (...args: any[]) => void
  ): Promise<void> {
    const stream = this.stream;
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
          await delay(timeout || 10_000);
          await putMemoValue(passedCanceler, false);
          const value = await getMemoValue(passedCanceler);
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
    let stream = this.stream;
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

export { CombineEmitter };
