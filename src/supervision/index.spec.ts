import { GenServer } from "../interfaces/genserver";
import EventEmitter from "events";
import {
  delay,
  memo,
  getMemoPromise,
  getMemoValue,
  putMemoValue,
} from "../utils";
import { ChildSpec, ChildRestartStrategy, RestartStrategy } from "./types";
import { supervise } from ".";
import { GenSupervisor } from "../interfaces/gensupervisor";
import { keyForIdSymbol } from "../utils/symbols";

class DelayFailurePermanentServer extends GenServer {
  protected async *init(
    ...args: unknown[]
  ): AsyncGenerator<unknown, any, unknown> {
    return null;
  }
  public async *start<U extends typeof GenServer>(
    startArgs: any,
    context: U,
    canceler: Generator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>
  ) {
    await delay(200);
    throw new Error("");
  }
  public async *childSpec(): AsyncGenerator<void, ChildSpec, unknown> {
    return {
      restart: ChildRestartStrategy.PERMANENT,
      shutdown: 10_000,
    };
  }
}

class DelayFailureTransientServer extends GenServer {
  protected async *init(
    ...args: unknown[]
  ): AsyncGenerator<unknown, any, unknown> {
    return null;
  }
  public async *start<U extends typeof GenServer>(
    startArgs: any,
    context: U,
    canceler: Generator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>
  ) {
    await delay(200);
    throw new Error("");
  }
  public async *childSpec(): AsyncGenerator<void, ChildSpec, unknown> {
    return {
      restart: ChildRestartStrategy.TRANSIENT,
      shutdown: 10_000,
    };
  }
}

class DelayFailureTemporaryServer extends GenServer {
  protected async *init(
    ...args: unknown[]
  ): AsyncGenerator<unknown, any, unknown> {
    return null;
  }
  public async *start<U extends typeof GenServer>(
    startArgs: any,
    context: U,
    canceler: Generator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>
  ) {
    await delay(200);
    throw new Error("");
  }
  public async *childSpec(): AsyncGenerator<void, ChildSpec, unknown> {
    return {
      restart: ChildRestartStrategy.TEMPORARY,
      shutdown: 10_000,
    };
  }
}

class DelayNormalPermanentServer extends GenServer {
  protected async *init(
    ...args: unknown[]
  ): AsyncGenerator<unknown, any, unknown> {
    return null;
  }
  public async *start<U extends typeof GenServer>(
    startArgs: any,
    context: U,
    canceler: Generator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>
  ) {
    await delay(200);
  }
  public async *childSpec(): AsyncGenerator<void, ChildSpec, unknown> {
    return {
      restart: ChildRestartStrategy.PERMANENT,
      shutdown: 10_000,
    };
  }
}

class DelayNormalTransientServer extends GenServer {
  protected async *init(
    ...args: unknown[]
  ): AsyncGenerator<unknown, any, unknown> {
    return null;
  }
  public async *start<U extends typeof GenServer>(
    startArgs: any,
    context: U,
    canceler: Generator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>
  ) {
    await delay(200);
  }
  public async *childSpec(): AsyncGenerator<void, ChildSpec, unknown> {
    return {
      restart: ChildRestartStrategy.TRANSIENT,
      shutdown: 10_000,
    };
  }
}

class PermanentCancellableServer extends GenServer {
  protected async *init(
    ...args: unknown[]
  ): AsyncGenerator<unknown, any, unknown> {
    return null;
  }
  public async *start<U extends typeof GenServer>(
    startArgs: any,
    context: U,
    canceler: Generator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>
  ) {
    while (getMemoValue(canceler)) {
      await delay(300);
    }
  }
  public async *childSpec(): AsyncGenerator<void, ChildSpec, unknown> {
    return {
      restart: ChildRestartStrategy.PERMANENT,
      shutdown: 10_000,
    };
  }
}

class DelayNormalTemporaryServer extends GenServer {
  protected async *init(
    ...args: unknown[]
  ): AsyncGenerator<unknown, any, unknown> {
    return null;
  }
  public async *start<U extends typeof GenServer>(
    startArgs: any,
    context: U,
    canceler: Generator<[boolean, EventEmitter], never, boolean>,
    cancelerPromise: Promise<boolean>
  ) {
    await delay(200);
  }
  public async *childSpec(): AsyncGenerator<void, ChildSpec, unknown> {
    return {
      restart: ChildRestartStrategy.TEMPORARY,
      shutdown: 10_000,
    };
  }
}

describe("supervise", () => {
  it(`should return a list of child specs after running them when any return or fail,
  and filter the ones that shouldn't be restarted in ONE_FOR_ALL strategy mode`, async () => {
    const upperCanceler = memo(true);
    const upperCancelerPromise = getMemoPromise(upperCanceler);
    const children = [
      [DelayFailureTransientServer, new DelayFailureTransientServer()],
      [DelayFailureTemporaryServer, new DelayFailureTemporaryServer()],
      [DelayFailurePermanentServer, new DelayFailurePermanentServer()],
      [DelayNormalTransientServer, new DelayNormalTransientServer()],
      [DelayNormalTemporaryServer, new DelayNormalTemporaryServer()],
      [DelayNormalPermanentServer, new DelayNormalPermanentServer()],
    ].map(async (value) => [
      value[0],
      value[1],
      <ChildSpec>(await (<GenServer>value[1]).childSpec().next()).value,
    ]);
    const resolvedChildren = <any>await Promise.all(children);
    const startSpies = resolvedChildren.map((child: any) =>
      jest.spyOn(child[1], "start")
    );
    const supervised = resolvedChildren.map(
      (
        childSpecs: [
          typeof GenServer,
          GenServer,
          ChildSpec,
          Generator<[boolean, EventEmitter], never, boolean>
        ]
      ) => ({
        id:
          childSpecs[1] instanceof GenSupervisor
            ? childSpecs[0].name
            : childSpecs[1][keyForIdSymbol],
        canceler: childSpecs[3],
      })
    );
    const supervisorGenerator = supervise(
      resolvedChildren,
      RestartStrategy.ONE_FOR_ALL,
      upperCanceler,
      upperCancelerPromise,
      supervised
    );
    let value;
    let done = false;
    while (!done) {
      const step = await supervisorGenerator.next();
      done = step.done || false;
      value = step.value;
    }
    startSpies.forEach((spy: any) => expect(spy).toHaveBeenCalledTimes(1));
    expect(value.childSpecs[0][1]).toBeInstanceOf(DelayFailureTransientServer);
    expect(value.childSpecs[1][1]).toBeInstanceOf(DelayFailurePermanentServer);
    expect(value.childSpecs[2][1]).toBeInstanceOf(DelayNormalPermanentServer);
  });
  it("should stop any running worker if one exits in ONE_FOR_ALL strategy mode", async () => {
    const upperCanceler = memo(true);
    const upperCancelerPromise = getMemoPromise(upperCanceler);
    const children = [
      [PermanentCancellableServer, new PermanentCancellableServer()],
      [PermanentCancellableServer, new PermanentCancellableServer()],
      [DelayNormalPermanentServer, new DelayNormalPermanentServer()],
    ].map(async (value) => [
      value[0],
      value[1],
      <ChildSpec>(await (<GenServer>value[1]).childSpec().next()).value,
    ]);
    const resolvedChildren = <any>await Promise.all(children);
    const startSpies = resolvedChildren.map((child: any) =>
      jest.spyOn(child[1], "start")
    );
    const supervised = resolvedChildren.map(
      (
        childSpecs: [
          typeof GenServer,
          GenServer,
          ChildSpec,
          Generator<[boolean, EventEmitter], never, boolean>
        ]
      ) => ({
        id:
          childSpecs[1] instanceof GenSupervisor
            ? childSpecs[0].name
            : childSpecs[1][keyForIdSymbol],
        canceler: childSpecs[3],
      })
    );
    const supervisorGenerator = supervise(
      resolvedChildren,
      RestartStrategy.ONE_FOR_ALL,
      upperCanceler,
      upperCancelerPromise,
      supervised
    );
    let value;
    let done = false;
    while (!done) {
      const step = await supervisorGenerator.next();
      done = step.done || false;
      value = step.value;
    }
    startSpies.forEach((spy: any) => expect(spy).toHaveBeenCalledTimes(1));
    expect(value.childSpecs.length).toEqual(3);
  });
  it("should stop any running worker if one fail in ONE_FOR_ALL strategy mode", async () => {
    const upperCanceler = memo(true);
    const upperCancelerPromise = getMemoPromise(upperCanceler);
    const children = [
      [PermanentCancellableServer, new PermanentCancellableServer()],
      [PermanentCancellableServer, new PermanentCancellableServer()],
      [DelayFailureTransientServer, new DelayFailureTransientServer()],
    ].map(async (value) => [
      value[0],
      value[1],
      <ChildSpec>(await (<GenServer>value[1]).childSpec().next()).value,
    ]);
    const resolvedChildren = <any>await Promise.all(children);
    const startSpies = resolvedChildren.map((child: any) =>
      jest.spyOn(child[1], "start")
    );
    const supervised = resolvedChildren.map(
      (
        childSpecs: [
          typeof GenServer,
          GenServer,
          ChildSpec,
          Generator<[boolean, EventEmitter], never, boolean>
        ]
      ) => ({
        id:
          childSpecs[1] instanceof GenSupervisor
            ? childSpecs[0].name
            : childSpecs[1][keyForIdSymbol],
        canceler: childSpecs[3],
      })
    );
    const supervisorGenerator = supervise(
      resolvedChildren,
      RestartStrategy.ONE_FOR_ALL,
      upperCanceler,
      upperCancelerPromise,
      supervised
    );
    let value;
    let done = false;
    while (!done) {
      const step = await supervisorGenerator.next();
      done = step.done || false;
      value = step.value;
    }
    startSpies.forEach((spy: any) => expect(spy).toHaveBeenCalledTimes(1));
    expect(value.childSpecs.length).toEqual(3);
  });
  it(`should loop workers forever, restarting ones that qualify for it,
  allowing stopping from external source in ONE_FOR_ONE restart strategy`, async () => {
    const upperCanceler = memo(true);
    const upperCancelerPromise = getMemoPromise(upperCanceler);
    const children = [
      [DelayFailureTransientServer, new DelayFailureTransientServer()],
      [DelayFailureTemporaryServer, new DelayFailureTemporaryServer()],
      [DelayFailurePermanentServer, new DelayFailurePermanentServer()],
      [DelayNormalTransientServer, new DelayNormalTransientServer()],
      [DelayNormalTemporaryServer, new DelayNormalTemporaryServer()],
      [DelayNormalPermanentServer, new DelayNormalPermanentServer()],
    ].map(async (value) => [
      value[0],
      value[1],
      <ChildSpec>(await (<GenServer>value[1]).childSpec().next()).value,
    ]);
    const resolvedChildren = <any>await Promise.all(children);
    const startSpies = resolvedChildren.map((child: any) =>
      jest.spyOn(child[1], "start")
    );
    const supervised = resolvedChildren.map(
      (
        childSpecs: [
          typeof GenServer,
          GenServer,
          ChildSpec,
          Generator<[boolean, EventEmitter], never, boolean>
        ]
      ) => ({
        id:
          childSpecs[1] instanceof GenSupervisor
            ? childSpecs[0].name
            : childSpecs[1][keyForIdSymbol],
        canceler: childSpecs[3],
      })
    );
    const supervisorGenerator = supervise(
      resolvedChildren,
      RestartStrategy.ONE_FOR_ONE,
      upperCanceler,
      upperCancelerPromise,
      supervised
    );
    const res = await Promise.all([
      supervisorGenerator.next(),
      new Promise<void>((resolve) =>
        setTimeout(() => {
          putMemoValue(upperCanceler, false);
          resolve();
        }, 5_000)
      ),
    ]);
    expect(startSpies[0]).toHaveBeenCalled();
    expect(startSpies[0]).not.toHaveBeenCalledTimes(1);
    expect(startSpies[1]).toHaveBeenCalledTimes(1);
    expect(startSpies[2]).toHaveBeenCalled();
    expect(startSpies[2]).not.toHaveBeenCalledTimes(1);
    expect(startSpies[3]).toHaveBeenCalledTimes(1);
    expect(startSpies[4]).toHaveBeenCalledTimes(1);
    expect(startSpies[5]).toHaveBeenCalled();
    expect(startSpies[5]).not.toHaveBeenCalledTimes(1);
    expect(res[0].value.childSpecs.length).toEqual(0);
  });
  it(`should loop workers forever, restarting all at once,
  allowing stopping from external source in ONE_FOR_ALL restart strategy`, async () => {
    const upperCanceler = memo(true);
    const upperCancelerPromise = getMemoPromise(upperCanceler);
    const children = [
      [DelayFailureTransientServer, new DelayFailureTransientServer()],
      [DelayFailureTemporaryServer, new DelayFailureTemporaryServer()],
      [DelayFailurePermanentServer, new DelayFailurePermanentServer()],
      [DelayNormalTransientServer, new DelayNormalTransientServer()],
      [DelayNormalTemporaryServer, new DelayNormalTemporaryServer()],
      [DelayNormalPermanentServer, new DelayNormalPermanentServer()],
    ].map(async (value) => [
      value[0],
      value[1],
      <ChildSpec>(await (<GenServer>value[1]).childSpec().next()).value,
    ]);
    const resolvedChildren = <any>await Promise.all(children);
    const startSpies = resolvedChildren.map((child: any) =>
      jest.spyOn(child[1], "start")
    );
    const supervised = resolvedChildren.map(
      (
        childSpecs: [
          typeof GenServer,
          GenServer,
          ChildSpec,
          Generator<[boolean, EventEmitter], never, boolean>
        ]
      ) => ({
        id:
          childSpecs[1] instanceof GenSupervisor
            ? childSpecs[0].name
            : childSpecs[1][keyForIdSymbol],
        canceler: childSpecs[3],
      })
    );
    const supervisorGenerator = supervise(
      resolvedChildren,
      RestartStrategy.ONE_FOR_ALL,
      upperCanceler,
      upperCancelerPromise,
      supervised
    );
    const res = await Promise.all([
      supervisorGenerator.next(),
      new Promise<void>((resolve) => {
        putMemoValue(upperCanceler, false);
        resolve();
      }),
    ]);
    expect(startSpies[0]).toHaveBeenCalledTimes(1);
    expect(startSpies[1]).toHaveBeenCalledTimes(1);
    expect(startSpies[2]).toHaveBeenCalledTimes(1);
    expect(startSpies[3]).toHaveBeenCalledTimes(1);
    expect(startSpies[4]).toHaveBeenCalledTimes(1);
    expect(startSpies[5]).toHaveBeenCalledTimes(1);
    expect(res[0].value.childSpecs.length).toEqual(0);
  });
  it("should return immediately if child specs is empty", async () => {
    const upperCanceler = memo(true);
    const upperCancelerPromise = getMemoPromise(upperCanceler);
    const supervisorGenerator = supervise(
      [],
      RestartStrategy.ONE_FOR_ONE,
      upperCanceler,
      upperCancelerPromise,
      []
    );
    const res = await supervisorGenerator.next();
    expect(res.value.childSpecs.length).toEqual(0);
  });
  it("should return immediately if strategy is not recognised", async () => {
    const upperCanceler = memo(true);
    const upperCancelerPromise = getMemoPromise(upperCanceler);
    const children = [
      [DelayFailureTransientServer, new DelayFailureTransientServer()],
      [DelayFailureTemporaryServer, new DelayFailureTemporaryServer()],
      [DelayFailurePermanentServer, new DelayFailurePermanentServer()],
      [DelayNormalTransientServer, new DelayNormalTransientServer()],
      [DelayNormalTemporaryServer, new DelayNormalTemporaryServer()],
      [DelayNormalPermanentServer, new DelayNormalPermanentServer()],
    ].map(async (value) => [
      value[0],
      value[1],
      <ChildSpec>(await (<GenServer>value[1]).childSpec().next()).value,
    ]);
    const resolvedChildren = <any>await Promise.all(children);
    const supervised = resolvedChildren.map(
      (
        childSpecs: [
          typeof GenServer,
          GenServer,
          ChildSpec,
          Generator<[boolean, EventEmitter], never, boolean>
        ]
      ) => ({
        id:
          childSpecs[1] instanceof GenSupervisor
            ? childSpecs[0].name
            : childSpecs[1][keyForIdSymbol],
        canceler: childSpecs[3],
      })
    );
    const supervisorGenerator = supervise(
      resolvedChildren,
      2,
      upperCanceler,
      upperCancelerPromise,
      supervised
    );
    const res = await supervisorGenerator.next();
    expect(res.value.childSpecs.length).toEqual(0);
  });
});
