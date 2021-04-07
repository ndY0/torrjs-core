"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
async function promisify(fn, context = null) {
    return new Promise((resolve, reject) => {
        fn.bind(context)((...result) => {
            resolve(...result);
        });
    });
}
function cure(fn, context = null) {
    return (first) => (...args) => fn.call(context, first, ...args);
}
async function* memo(initialState) {
    let state = initialState;
    const emitter = new events_1.default();
    while (true) {
        const passed = yield [state, emitter];
        if (passed !== undefined) {
            state = passed;
            emitter.emit("updated", state);
        }
    }
}
async function getMemoPromise(memo) {
    const { value: [_, emitter], } = await memo.next();
    return promisify(cure(emitter.once, emitter)("updated"), emitter);
}
async function getMemoValue(memo) {
    const { value: [memoized, _], } = await memo.next();
    return memoized;
}
async function putMemoValue(memo, value) {
    await memo.next(value);
}
async function run() {
    const test = memo(true);
    const promise = getMemoPromise(test);
    promise.then((val) => console.log("from promise", val));
    console.log("from getter", await getMemoValue(test));
    await putMemoValue(test, false);
    console.log("from getter", await getMemoValue(test));
}
run();
