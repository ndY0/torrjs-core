const step = async function* <T>(curr: T): AsyncGenerator<T, any, T> {
  yield await new Promise(
    (resolve: (value: T) => void, reject: (reason: Error) => void) => {
      setTimeout(() => {
        resolve(curr);
      }, 1000);
    }
  );
};

const init = async function* <T>(startArgs: any): AsyncGenerator<any, T, T> {
  return startArgs;
};

// const GenServer = () => {};

const run = async function* <T>(startArgs: any): AsyncGenerator<T, void, T> {
  console.log("starArgs", startArgs);
  const initState = yield* init<T>(startArgs);
  console.log("initState", initState);
  let state = initState;
  while (true) {
    state = yield* step<T>(state);
  }
};

const start = async () => {
  await tail(run(0));
};

start();
