import { database, ObjectId } from "@spica-devkit/database";
import * as Identity from "@spica-devkit/identity";
import fetch from 'node-fetch';

const DUEL_BUCKET_ID = process.env.DUEL_BUCKET_ID;
const SECRET_API_KEY = process.env.SECRET_API_KEY;

const MAIN_SERVER_URL = "https://bip-4islem-d6738.hq.spicaengine.com/api";
const OPERATION_KEY = '6Ww7PajcsGH34PbE';

let db;

export async function removeIndetity(changed) {
    let target = changed.previous;

    if (!db) {
        db = await database().catch(err => console.log("ERROR ", err));
    }

    await db.collection('identity').deleteMany({ "attributes.duel_id": target._id })
        .catch(err => console.log("ERROR ", err))
}

export async function clearIdentity() {
    if (!db) {
        db = await database().catch(err => console.log("ERROR ", err));
    }

    const date1 = new Date()
    date1.setMinutes(date1.getMinutes() - 15)

    const customObjectId = Math.floor(date1.getTime() / 1000).toString(16) + "0000000000000000";

    await db.collection('identity').deleteMany({
        _id: {
            $lt: ObjectId(customObjectId)
        },
        "attributes.duel_id": {
            $exists: true
        },
        identifier: { $nin: ['spica', 'serdar'] }
    })
        .catch(err => console.log("ERROR ", err))

    return true
}

export async function setReady(req, res) {
    const { duelId, user_placement } = req.body;

    const token = getTokenByReq(req);
    const decodedToken = await getDecodedToken(token)
    if (!decodedToken) {
        return res.status(400).send({ message: "Token is not verified." });
    }

    if (!db) {
        db = await database().catch(err => console.log("ERROR 30", err));
    }

    const duelCollection = db.collection(`bucket_${DUEL_BUCKET_ID}`);

    let setQuery = {};
    setQuery[user_placement] = true;
    await duelCollection
        .updateOne(
            { _id: ObjectId(duelId) },
            {
                $set: setQuery
            }
        )
        .catch(err => console.log("ERROR 2 ", err));

    await fetchRequest('setReadyMainServer', decodedToken.attributes.user_id, String(duelId))
        .catch(err => console.log("ERROR setReady: ", err));

    return res.status(200).send({ message: "successful" });
}

export async function decreasePlayCount(req, res) {
    const { duelId, userId } = req.body;

    const token = getTokenByReq(req);
    const decodedToken = await getDecodedToken(token)
    if (!decodedToken) {
        return res.status(400).send({ message: "Token is not verified." });
    }

    await fetchRequest('playCountDecrease', userId, duelId)
        .catch(err => console.log("ERROR decreasePlayCount: ", err));

    return res.status(200).send({ message: "successful" });
}

export async function updateServerInfo(req, res) {
    const { duelId, userId } = req.body;

    const token = getTokenByReq(req);
    const decodedToken = await getDecodedToken(token)
    if (!decodedToken) {
        return res.status(400).send({ message: "Token is not verified." });
    }

    await fetchRequest('serverInfoUpdate', userId, duelId)
        .catch(err => console.log("ERROR serverInfoUpdate: ", err));

    return res.status(200).send({ message: "successful" });
}

async function fetchRequest(endpoint, userId, duelId) {
    await fetch(
        `${MAIN_SERVER_URL}/fn-execute/${endpoint}`,
        {
            method: "post",
            body: JSON.stringify({
                userId: userId,
                duelId: duelId,
                key: OPERATION_KEY
            }),
            headers: {
                "Content-Type": "application/json",
            }
        }
    ).catch(err => console.log("ERROR PLAY COUNT DECREASE", err));
}

export function getTokenByReq(req) {
    let token = req.headers.get("authorization")
    if (!token) {
        return
    }
    return token.split(" ")[1];
}

export async function getDecodedToken(token) {
    Identity.initialize({ apikey: `${SECRET_API_KEY}` });
    return Identity.verifyToken(token).catch(console.error)
}