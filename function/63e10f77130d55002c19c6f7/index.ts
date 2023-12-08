import * as Api from "../../655b4080c250ea002c7832a7/.build";
import { env as VARIABLE } from "../../655b40e8c250ea002c783322/.build";

const OPERATION_KEY = VARIABLE.OPERATION_KEY;
const DUEL_INFO_BUCKET = VARIABLE.BUCKET.DUEL_INFO;

const DUEL_BUCKET = {
    [VARIABLE.SERVICE.SAYI_KRALI]: VARIABLE.BUCKET.SAYI_KRALI_DUEL
}

export function clearScheduler() {
    const date = new Date()
    date.setMinutes(date.getMinutes() - 15)

    clearIdentity(date);
    clearServerInfo(date);
}

async function clearIdentity(date) {
    const db = await Api.useDatabase();

    const customObjectId = Math.floor(date.getTime() / 1000).toString(16) + "0000000000000000";

    await db.collection('identity').deleteMany({
        _id: {
            $lt: Api.toObjectId(customObjectId)
        },
        "attributes.duel_id": {
            $exists: true
        },
        identifier: { $nin: ['spica', 'serdar'] }
    }).catch(err => console.log("ERROR ", err))
}

async function clearServerInfo(date) {
    const db = await Api.useDatabase();

    await db.collection(`bucket_${DUEL_INFO_BUCKET}`).deleteMany({ created_at: { $lt: date } })
        .catch(err => console.log("ERROR ", err))
}

export async function setReady(req, res) {
    const { token, duelId, userPlacement } = req.body;

    const decodedToken = await getDecodedToken(token)
    if (!decodedToken) {
        return res.status(400).send({ message: "Token is not verified." });
    }

    const service = decodedToken.attributes.service;
    const db = await Api.useDatabase();
    const duelCollection = db.collection(`bucket_${DUEL_BUCKET[service]}`);

    let setQuery = {};
    setQuery[userPlacement] = true;
    await duelCollection
        .updateOne(
            { _id: Api.toObjectId(duelId) },
            {
                $set: setQuery
            }
        )
        .catch(err => console.log("ERROR 2 ", err));

    await httpRequest('setReadyMainServer', service, decodedToken.attributes.user_id, String(duelId))
        .catch(err => console.log("ERROR setReady: ", err));

    return res.status(200).send({ message: "successful" });
}

async function httpRequest(endpoint, service, userId, duelId) {
    await Api.httpRequest("post", `${VARIABLE.MAIN_SERVER_URL[service]}/fn-execute/${endpoint}`, {
        userId: userId,
        duelId: duelId,
        key: OPERATION_KEY
    }, {}).catch(err => console.log("ERROR PLAY COUNT DECREASE", err));
}

export async function getDecodedToken(token) {
    const Identity = Api.useIdentity();
    return Identity.verifyToken(token).catch(console.error)
}