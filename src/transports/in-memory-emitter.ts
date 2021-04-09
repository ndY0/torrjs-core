import { TransportEmitter } from "./interface";
import { Duplex } from "stream";
import { InMemoryDuplex } from "../streams/in-memory-duplex";
import { memo, getMemoValue, putMemoValue, promisify, cure } from "../utils";

class InMemoryEmitter implements TransportEmitter {
  private streams: Map<string | symbol, Duplex> = new Map<
    string | symbol,
    Duplex
  >();
  public constructor(private readonly queueSize: number) {}
  public async once(
    { timeout, event }: { timeout?: number; event: string | symbol },
    listener: (...args: any[]) => void
  ): Promise<void> {
    let stream = this.streams.get(event);
    if (!stream) {
      stream = new InMemoryDuplex(this.queueSize);
      this.streams.set(event, stream);
    }
    const canceler = memo(true);

    const result = await Promise.race([
      promisify(cure(stream.once, stream)("data"), stream).then(() => {
        const test = (<Duplex>stream).read();
        console.log(test);
        return (<Duplex>stream).read();
      }),
      ,
      new Promise<boolean>((resolve) =>
        setTimeout(() => {
          putMemoValue(canceler, false), resolve(false);
        }, timeout || 5_000)
      ),
    ]);
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
    const ok = stream.write({ event, args });
    console.log(ok);
    if (!ok) {
      return await Promise.race([
        promisify(cure(stream.once, stream)("drain"), stream).then(() => {
          (<Duplex>stream).write({ event, args });
          return true;
        }),
        new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(false), timeout || 5_000)
        ),
      ]);
    }
    return true;
  }
}

export { InMemoryEmitter };
