// Test fixture: a well-behaved plugin worker. Signals ready, then
// heartbeats on a fast cadence so drill tests run quickly.
import { parentPort } from "node:worker_threads"

parentPort.postMessage({ type: "ready" })
setInterval(() => parentPort.postMessage({ type: "heartbeat" }), 10)
