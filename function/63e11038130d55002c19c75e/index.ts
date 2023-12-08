import { env as VARIABLE } from "../../655b40e8c250ea002c783322/.build";
import * as Api from "../../655b4080c250ea002c7832a7/.build";

const SERVER_NAME = VARIABLE.SERVER_NAME;
const USER_POLICY = VARIABLE.USER_POLICY;
const PASSWORD_SALT = VARIABLE.PASSWORD_SALT;
const CONFIGURATION_BUCKET = VARIABLE.BUCKET.CONFIGURATION;

const DUEL_INFO_BUCKET = VARIABLE.BUCKET.DUEL_INFO;
const DUEL_BUCKET = {
    [VARIABLE.SERVICE.SAYI_KRALI]: VARIABLE.BUCKET.SAYI_KRALI_DUEL
}

export async function newGameListener(req, res) {
    console.log("@newGameListener")
    const { referenceNo, service, data, users } = req.body;

    const isAvailable = await checkAvailability();
    if (!isAvailable) {
        return res.status(200).send({
            message: "Server is not available"
        });
    }

    const tokens = [];
    const duelId = await createDuel(service, data);
    for (let user of users) {
        let token = await createIdentity(user, service, duelId);
        tokens.push(token)
    }

    sendRequestToAssignDuel(service, {
        duelData: data,
        referenceNo,
        tokens,
        duelId,
        serverName: SERVER_NAME
    });

    return res.status(200).send({
        message: "Server is available",
    });
}

async function sendRequestToAssignDuel(service, body) {
    console.log("@sendRequestToAssignDuel")
    try {
        console.log("body: ", body)
        const res = await Api.httpRequest("post", `${VARIABLE.MAIN_SERVER_URL[service]}/fn-execute/assign-duel`, body, {}).then(res => res.data);

        const db = await Api.useDatabase();
        db.collection(`bucket_${DUEL_INFO_BUCKET}`).insertOne({
            service,
            duel_id: body.duelId,
            created_at: new Date()
        })

        console.log("@sendRequestToAssignDuel RES", res)
    } catch (err) {
        console.log("@sendRequestToAssignDuel ERR", err)
    }
}

async function checkAvailability() {
    const db = await Api.useDatabase();

    const maxDuelCapacity = await db
        .collection(`bucket_${CONFIGURATION_BUCKET}`)
        .findOne({ key: "max_duel_capacity" })

    const duelCount = await db.collection(`bucket_${DUEL_INFO_BUCKET}`).find().count()
    if (duelCount >= maxDuelCapacity.value) return false;

    return true;
}

async function createDuel(service, data) {
    const db = await Api.useDatabase();

    data['created_at'] = new Date(data['created_at']);

    const duelData = await db
        .collection(`bucket_${DUEL_BUCKET[service]}`)
        .insertOne(data).catch(err => console.log("ERROR ", err))

    return duelData.ops[0]._id
}

async function createIdentity(userId, service, duelId) {
    const Identity = Api.useIdentity();
    let msisdn = `1111${msisdnGenerate(6)}`;

    await Identity.insert({
        identifier: msisdn,
        password: PASSWORD_SALT,
        policies: [`${USER_POLICY}`],
        attributes: {
            msisdn: msisdn,
            user_id: userId,
            duel_id: duelId,
            service: service
        }
    }).catch(err => console.log("ERROR ", err))

    return await Identity.login(msisdn, PASSWORD_SALT).catch(err => console.log("ERROR ", err));
}

function msisdnGenerate(length) {
    let result = "";
    let characters = "123456789";
    let charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
