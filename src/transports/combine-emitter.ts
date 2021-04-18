import { TransportEmitter } from "./interface";
import { Duplex, EventEmitter, PassThrough } from "stream";
import { InMemoryDuplex } from "../streams/in-memory-duplex";
import {
  memo,
  getMemoValue,
  putMemoValue,
  promisify,
  cure,
  delay,
} from "../utils";
import { combineStreams } from "../streams/combine-streams";

class CombineEmitter implements TransportEmitter {
  private stream: Duplex;
  constructor(streams: Duplex[]) {
    this.stream = combineStreams(streams);
  }
  getInternalStreamType() {
    return PassThrough;
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
      timeout?: number | Promise<boolean>;
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
          typeof timeout === "number" || timeout === undefined
            ? await delay(timeout || 10_000)
            : await timeout;
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
  public async emit(..._args: any[]): Promise<boolean> {
    throw new Error("this merged readable shouldn't be emitting");
  }
}

export { CombineEmitter };
