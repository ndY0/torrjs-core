"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
function cancelablePromiseFactory(executor, emitter) {
    return new Promise((innerResolve, innerReject) => {
        // try {
        emitter.once("cancel", (reason) => {
            // throw new Error(reason);
            innerReject(reason);
        });
        executor(innerResolve, innerReject);
        // } catch (reason) {
        // }
    });
}
const emitter = new events_1.default();
const promise1 = cancelablePromiseFactory((resolve) => setTimeout(() => (console.log("resolved !"), resolve(1)), 1000), emitter);
const promise2 = cancelablePromiseFactory((resolve) => setTimeout(() => (console.log("resolved !"), resolve(2)), 500), emitter);
const promise3 = cancelablePromiseFactory((resolve) => setTimeout(() => (console.log("resolved !"), resolve(3)), 2000), emitter);
const list = [promise1, promise2, promise3];
Promise.any(list).then((value) => {
    emitter.emit("cancel");
    console.log(value, list);
});
