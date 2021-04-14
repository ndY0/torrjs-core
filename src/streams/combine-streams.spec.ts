import { InMemoryDuplex } from "./in-memory-duplex";
import { combineStreams } from "./combine-streams";
import { delay } from "../utils";

describe("MultiplexReadable", () => {
  it("should pipe multiple Duplex into one readable stream, and emit readable when any of them emits", async () => {
    const duplex1 = new InMemoryDuplex(10);
    const duplex2 = new InMemoryDuplex(10);
    const duplex3 = new InMemoryDuplex(10);
    const readable = combineStreams([duplex1, duplex2, duplex3]);
    const res: any[] = [];
    readable.on("data", (data) => {
      res.push(data);
    });
    duplex1.write({ test: "duplex1" });
    duplex2.write({ test: "duplex2" });
    duplex3.write({ test: "duplex3" });
    await delay(10);
    expect(res).toEqual([
      { test: "duplex1" },
      { test: "duplex2" },
      { test: "duplex3" },
    ]);
  });
  it("should pause the upstreams if to many events are written", async () => {
    const duplex1 = new InMemoryDuplex(10);
    const duplex2 = new InMemoryDuplex(10);
    const duplex3 = new InMemoryDuplex(10);
    const readable = combineStreams([duplex1, duplex2, duplex3]);
    const res: any[] = [];
    let hasWritten1 = 0,
      hasWritten2 = 0,
      hasWritten3 = 0;
    for (let index = 0; index < 60; index++) {
      hasWritten1 = duplex1.write({ test: "duplex1" })
        ? hasWritten1 + 1
        : hasWritten1;
      hasWritten2 = duplex2.write({ test: "duplex2" })
        ? hasWritten2 + 1
        : hasWritten2;
      hasWritten3 = duplex3.write({ test: "duplex3" })
        ? hasWritten3 + 1
        : hasWritten3;
    }
    await delay(1000);
    let data = true;
    while (data) {
      data = readable.read(1);
      if (data) {
        res.push(data);
      }
    }
    expect(hasWritten1).toEqual(39);
    expect(hasWritten2).toEqual(38);
    expect(hasWritten3).toEqual(38);
    expect(res.length).toEqual(180);
  });
});
