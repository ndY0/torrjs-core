import { InMemoryEmitter } from "./transports/in-memory-emitter";
import { take } from "./effects";

const test = async () => {
  const emitter = new InMemoryEmitter(1000);
  console.log("called");
  const computationResult = await Promise.all([
    take("test", emitter).next(),
    new Promise<void>((resolve) => {
      console.log("emitting !");
      setTimeout(() => {
        console.log("inside timeout");
        emitter.emit({ event: "test" }, { value: "test" });
        resolve();
      }, 2000);
    }).catch(console.log),
  ]);
  console.log("computation result", computationResult);
};

test();
