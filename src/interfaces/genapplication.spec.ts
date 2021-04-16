describe("", () => {
  it("", () => {});
});

// import "reflect-metadata";
// import { GenApplication } from "./genapplication";
// import {
//   ChildRestartStrategy,
//   RestartStrategy,
//   ChildSpec,
// } from "../supervision/types";
// import { getMemoPromise, memo, delay } from "../utils";
// import { Server } from "../annotations/server";
// import { InMemoryEmitter } from "../transports/in-memory-emitter";
// import { GenSupervisor } from "./gensupervisor";
// import { GenServer } from "./genserver";
// import EventEmitter from "events";

// class DelayNormalTemporaryServer extends GenServer {
//   protected async *init(
//     ...args: unknown[]
//   ): AsyncGenerator<unknown, any, unknown> {
//     return null;
//   }
//   public async *start<U extends typeof GenServer>(
//     startArgs: any,
//     context: U,
//     canceler: AsyncGenerator<[boolean, EventEmitter], never, boolean>,
//     cancelerPromise: Promise<boolean>
//   ) {
//     await delay(200);
//   }
//   public async *childSpec(): AsyncGenerator<void, ChildSpec, unknown> {
//     return {
//       restart: ChildRestartStrategy.TEMPORARY,
//       shutdown: 10_000,
//     };
//   }
// }

// @Server(new InMemoryEmitter(10), { test: new InMemoryEmitter(10) })
// class TestTemporarySupervisor extends GenSupervisor {
//   protected async *children() {
//     return [DelayNormalTemporaryServer, DelayNormalTemporaryServer];
//   }
// }

// describe("GenApplication", () => {
//   it("should initialize a memo canceler and the linked promise at initialisation", () => {
//     const application = new GenApplication({
//       childStrategy: RestartStrategy.ONE_FOR_ALL,
//       supervise: [DelayNormalTemporaryServer, TestTemporarySupervisor],
//     });
//     const memo1 = Reflect.get(application, "canceler");
//     const memoPromise = Reflect.get(application, "cancelerPromise");
//     const testMemo = memo(true);
//     const testMemoPromise = getMemoPromise(testMemo);
//     expect(memo1).toEqual(testMemo);
//     expect(memoPromise).toEqual(testMemoPromise);
//   });
//   describe("start", () => {
//     it(`should loop supervised children with provided strategy --- ONE_FOR_ALL and stop when stop is called`, async () => {
//       const application = new GenApplication({
//         childStrategy: RestartStrategy.ONE_FOR_ALL,
//         supervise: [DelayNormalTemporaryServer, TestTemporarySupervisor],
//       });

//       const initSpy = jest.spyOn(<any>application, "init");
//       const runSpy = jest.spyOn(<any>application, "run");
//       const res = Promise.all([
//         application.start(),
//         (async () => {
//           console.log("called !");
//           await delay(1000);
//           await application.stop();
//           await delay(10_000);
//         })(),
//       ]);
//       console.log(res);
//       expect(initSpy).toHaveBeenCalledTimes(1);
//       expect(runSpy).not.toHaveBeenCalledTimes(0);
//       expect(runSpy).not.toHaveBeenCalledTimes(1);
//       await delay(6000);
//     });
//   });
// });
