export function getStartDate() {
    let started_at = new Date();
    started_at.setSeconds(started_at.getSeconds() + 5);

    return JSON.stringify(started_at.toISOString());
}

/*

const net = require('net');

class SocketClient {
    constructor() {
        // this.SOCKET_IP_ADDRESS = '185.11.12.199';
        this.SOCKET_IP_ADDRESS = 'socketsbay.com/wss/v2/1/demo/';
        this.PORT = 2144;
        this.connection = null;
    }

    connect() {
        this.connection = new net.Socket();

        this.connection.connect("socketsbay.com/wss/v2/1/demo/");

        this.connection.on('error', (error) => {
            console.error(error);
        });
    }

    disconnect() {
        if (this.connection) {
            this.connection.end();
        }
    }

    sendMessage(message) {
        console.log(message);
        this.connection.write(message, 'utf-8', () => {
            this.connection.once('data', (data) => {
                console.log(data.toString('utf-8').trim());
            });
        });
    }
}

export async function testSendMessage(req, res) {
    const client = new SocketClient();

    client.connect();

    client.sendMessage('info 5469178539');

    client.disconnect();

    return "ok"
}

const { Telnet } = require('telnet-client')
const connection = new Telnet()

export function telnetClient() {
    // these parameters are just examples and most probably won't work for your use-case.
    const params = {
        host: 'mma.vodafone.com.tr',
        port: 2144,
        timeout: 1500
    }

    connection.on('ready', prompt => {
        connection.exec(cmd, (err, response) => {
            console.log(response)
        })
    })

    connection.on('timeout', () => {
        console.log('socket timeout!')
        connection.end()
    })

    connection.on('close', () => {
        console.log('connection closed')
    })

    connection.connect(params)

    setTimeout(() => {
        connection.end()
    }, 2500)

    return "ok"
}


function delay(milliseconds) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
}

import { io } from "socket.io-client";
export async function socketIOTest(req, res) {

    console.log("socket IO TEST");
    const socket = io("wss://socketsbay.com/wss/v2/1/demo", {
        reconnectionDelayMax: 10000,
    });

    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.io.on("error", (error) => {
        console.log(error);
    });

    socket.on('message', (data) => {
        console.log('Received message:', data);
    });


    socket.emit("clientMessage", "info 5469178539");
    // socket.close();

    await delay(1000);
    return "ok";
}

*/