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
let filters = [];
let relays = [];
// let socketInstance = null;

function onEvent(event, relay) {
    // postMessage(`[RELAY WORKER] Web worker got this event from ${relay}: ${JSON.stringify(event, null, 2)}`)
    postMessage({ type: 'event', event, relay })
}

function createSubscriptionInstance(filters, relays) {
    //    let socket = new WebSocket("ws://localhost:8080");

    //    return socket;
    for (let relay of relays) pool.addRelay(relay, { read: true, write: false })
    postMessage(`[RELAY WORKER] Web worker creating subscription using filter ${JSON.stringify(filters, null, 2)} for relays ${JSON.stringify(relays, null, 2)}`)
    // let sub = pool.sub({
    //     cb: (event, relay) => {
    //         console.log(`got an event from ${relay}.`, event)
    //     }, filter: filters
    // })
    // subscription = pool.sub({ cb: onEvent, filter: filters })
    return pool.sub({ cb: onEvent, filter: filters })
}

// function socketManagement() {
//     if (socketInstance) {
//         socketInstance.onopen = function (e) {
//             console.log("[open] Connection established");
//             postMessage("[SOCKET] Connection established");
//             socketInstance.send(JSON.stringify({ socketStatus: true }));
//             postMessage({ disableStartButton: true });
//         };

//         socketInstance.onmessage = function (event) {
//             console.log(`[message] Data received from server: ${event.data}`);
//             postMessage(event.data);
//         };

//         socketInstance.onclose = function (event) {
//             if (event.wasClean) {
//                 console.log(`[close] Connection closed cleanly, code=${event.code}`);
//                 postMessage(`[SOCKET] Connection closed cleanly, code=${event.code}`);
//             } else {
//                 // e.g. server process killed or network down
//                 // event.code is usually 1006 in this case
//                 console.log('[close] Connection died');
//                 postMessage('[SOCKET] Connection died');
//             }
//             postMessage({ disableStartButton: false });
//         };

//         socketInstance.onerror = function (error) {
//             console.log(`[error] ${error.message}`);
//             postMessage(`[SOCKET] ${error.message}`);
//             socketInstance.close();
//         };
//     }
// }

//SWITCH CASE: SOCKET MANAGEMENT:
// eslint-disable-next-line no-restricted-globals
self.onmessage = function (e) {
    const workerData = e.data;
    switch (workerData.type) {
        case "sub":
            //    socketInstance = createSocketInstance(workerData.filters, workerData.relays);
            filters = workerData.filters;
            relays = workerData.relays;
            subscription = createSubscriptionInstance(filters, relays);
            // subscriptionManagement();
            break;

        case "unsub":
            postMessage("[RELAY WORKER] Web worker closing subscription");
            subscription.unsub();
            break;

        case "updateFilters":
            filters = workerData.filters
            subscription.sub({ filter: filters })
            postMessage(`[RELAY WORKER] Web worker updated subscription filters to ${JSON.stringify(filters, null, 2)}`);
            break;

        case "updateRelays":
            // subscription.sub({filter: workerData.filters})
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