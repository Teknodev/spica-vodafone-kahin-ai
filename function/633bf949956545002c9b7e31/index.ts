import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

// const { Telnet } = require('telnet-client');

const USER_BUCKET = VARIABLE.BUCKET.USER;

export async function replaceAbusiveName() {
    const dateNow = new Date();
    let filterDate = new Date(dateNow.setMinutes(dateNow.getMinutes() - 90))
    const wordsArr = await getAbusiveNames();

    const db = await Api.useDatabase();
    const userData = await db
        .collection(`bucket_${USER_BUCKET}`)
        .find({ created_at: { $gte: filterDate }, name: { $in: wordsArr } }).toArray()
        .catch(err => console.log("ERROR 2", err));

    for (const user of userData) {
        console.log(`user_id: ${user._id} - name: ${user.name}`)
        let random = Math.floor(Math.random() * 100000) + 1
        await db
            .collection(`bucket_${USER_BUCKET}`)
            .updateOne({ _id: Api.toObjectId(user._id) }, { $set: { name: `Kullanıcı34${random}` } })
            .catch(err => console.log("ERROR 2", err));
    }
}

export async function insertDataWithId(req, res) {
    const { data } = req.body;
    const db = await Api.useDatabase();
    const collection = db.collection('bucket_605c9480e9960e002c278191');

    // const policies = await collection.find().toArray();
    data.forEach(el => {
        el._id = Api.toObjectId(el._id)
    })

    await collection.insertMany(data).catch(console.error)
    return res.status(200).send({ message: 'ok' })
}

export function differenceBetweenDates(date1, date2) {
    const date1Seconds = Math.floor(new Date(date1).getTime() / 1000);
    const date2Seconds = Math.floor(new Date(date2).getTime() / 1000);
    return date1Seconds - date2Seconds;
}

export function getTokenByReq(req) {
    let token = req.headers.get("authorization")
    if (!token) {
        return
    }
    return token.split(" ")[1];
}

export async function getDecodedToken(token) {
    const Identity = await Api.useIdentity();
    return Identity.verifyToken(token).catch(console.error)
}

export function codeGenerate(length) {
    let result = "";
    let characters = "123456789";
    let charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return parseInt(result);
}

async function getAbusiveNames() {
    let response;
    try {
        response = await Api.httpRequest("get", "https://raw.githubusercontent.com/idriska/turkce-kufur-karaliste/master/karaliste.json")
    } catch (err) {
        console.log(err)
    }

    return response.data;
}


export async function getMyIp(req, res) {
    const response = await Api.httpRequest("get", "https://api.ipify.org?format=json").catch(console.error)
    console.log("data", response.data)

    return res.status(200).send({ message: 'ok' })
}

/*

const WebSocket = require('ws');

let socket;
export function createConnection() {
    console.log("ID: 12342346")
    if (!socket) {
        socket = new WebSocket('ws://mma.vodafone.com.tr:2144');
        // socket = new WebSocket('wss://socketsbay.com/wss/v2/1/demo/');
    }

    // Connection event
    socket.on('open', () => {
        console.log('Connected to remote server');
    });

    // Message event
    socket.on('message', (message) => {
        console.log(message);
    });

    // Close event
    socket.on('close', () => {
        console.log('Connection closed');
    });

    socket.on('error', (error) => {
        console.log(error);
    });

    setTimeout(() => {
        console.log("readyState: ", socket.readyState, WebSocket.OPEN);
        // if (socket.readyState === WebSocket.OPEN) {
            console.log("IF")
            socket.send("info 5367022769");
            socket.close();
        // }
    }, 2500)

    return "ok"
}

*/

// function sendMessageToServer() {
//     if (socket.readyState === WebSocket.OPEN) {
//         // Check if the connection is open before sending the message
//         socket.send("dload 633bf949956545002c9b7e31 16549 5367022769 3:5:3221225472");
//     } else {
//         console.log('Connection is not open. Cannot send message.');
//     }
// }

// export async function removeChargeCount() {
//     const db = await Api.useDatabase();
//     await db
//         .collection(`bucket_${USER_BUCKET}`)
//         .updateMany({ bot: true }, { $unset: { weekly_point: '' } })
//         .catch(err => console.log("ERROR 2", err));


//     return "ok"
// }