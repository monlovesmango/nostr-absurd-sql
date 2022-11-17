import { relayPool } from 'nostr-tools'
// import { relayPool } from './test.js'
/**
 * 1. when socket is opened send the flag to socket.
 * 2. Send the data to the client for dsiabling the start connection worker via webworker. Do the same while closing the connection.
 * adapted from https://github.com/keyurparalkar/webworker_examples/blob/main/client/src/workers/main.worker.js
 * https://www.freecodecamp.org/news/how-webworkers-work-in-javascript-with-example/
 */
const pool = relayPool();
let subscription = null;
let filter = [];
let relays = [];

function onEvent(event, relay) {
    // postMessage(`[RELAY WORKER] Web worker got this event from ${relay}: ${JSON.stringify(event, null, 2)}`)
    postMessage({ type: 'event', event, relay })
}

// function createSubscriptionInstance(filter, relays) {
//     //    let socket = new WebSocket("ws://localhost:8080");

//     //    return socket;
//     for (let relay of relays) pool.addRelay(relay, { read: true, write: false })
//     postMessage(`[RELAY WORKER] Web worker creating subscription using filter ${JSON.stringify(filter, null, 2)} for relays ${JSON.stringify(relays, null, 2)}`)
//     // let sub = pool.sub({
//     //     cb: (event, relay) => {
//     //         console.log(`got an event from ${relay}.`, event)
//     //     }, filter: filter
//     // })
//     // subscription = pool.sub({ cb: onEvent, filter: filter })
//     return pool.sub({ cb: onEvent, filter })
// }

self.onmessage = function (e) {
    const workerData = e.data;
    switch (workerData.type) {
        // case "sub":
        //     filter = workerData.filter;
        //     relays = workerData.relays;
        //     subscription = createSubscriptionInstance(filter, relays);
        //     break;

        case "unsub":
            postMessage("[RELAY WORKER] Web worker closing subscription");
            subscription.unsub();
            subscription = null;
            break;

        case "setFilter":
            filter = workerData.filter
            if (subscription) subscription.sub({ cb: onEvent, filter })
            else subscription = pool.sub({ cb: onEvent, filter })
            postMessage(`[RELAY WORKER] Web worker updated subscription filter to ${JSON.stringify(filter, null, 2)}`);
            break;

        case "setRelays":
            relays.forEach(relay => {
                if (!workerData.relays.includes(relay)) pool.removeRelay(relay)
            })
            workerData.relays.forEach(relay => {
                if (!relays.includes(relay)) pool.addRelay(relay)
            })
            relays = workerData.relays;
            postMessage(`[RELAY WORKER] Web worker updated subscription relays to ${JSON.stringify(relays, null, 2)}`);
            break;

        default:
            postMessage("[RELAY WORKER] Web worker unhandled message ", workerData);
        // subscriptionManagement();
    }
}