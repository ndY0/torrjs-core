import EventEmitter from "events";
import { resolve } from "path";

function cancelablePromiseFactory<T>(
  executor: (
    resolve: (value?: T) => void,
    reject?: (reason?: any) => void
  ) => void,
  emitter: EventEmitter
): Promise<T> {
  return new Promise<T>((innerResolve, innerReject) => {
    // try {
    executor((value) => {
      innerResolve();
    }, innerReject);
    // } catch (reason) {
    // }
  });
}
const emitter = new EventEmitter();
const promise1 = cancelablePromiseFactory<number>(
  (resolve) => setTimeout(() => (console.log("resolved !"), resolve(1)), 1000),
  emitter
);
const promise2 = cancelablePromiseFactory(
  (resolve) => setTimeout(() => (console.log("resolved !"), resolve(2)), 500),
  emitter
);
const promise3 = cancelablePromiseFactory(
  (resolve) => setTimeout(() => (console.log("resolved !"), resolve(3)), 2000),
  emitter
);

const list = [promise1, promise2, promise3];

Promise.any(list).then((value) => {
  emitter.emit("cancel");
  console.log(value, list);
});
