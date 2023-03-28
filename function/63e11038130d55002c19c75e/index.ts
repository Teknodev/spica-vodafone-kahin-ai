import { database, ObjectId } from "@spica-devkit/database";
import * as Identity from "@spica-devkit/identity";

const DUEL_BUCKET = process.env.DUEL_BUCKET;
const CONFIGURATION_BUCKET = process.env.CONFIGURATION_BUCKET;
const PASSWORD_SALT = process.env.PASSWORD_SALT;
const USER_POLICY = process.env.USER_POLICY;
const SECRET_API_KEY = process.env.SECRET_API_KEY;

let db;

export async function checkAvailability(req, res) {
    const { data, users, code } = req.body;

    if (!db) {
        db = await database().catch(err => console.log("ERROR 2", err));
    }

    let availableCount = 0;
    const tokens = [];

    const duelCapacity = await db
        .collection(`bucket_${CONFIGURATION_BUCKET}`)
        .findOne({ key: "max_duel_capacity" }).catch(err => console.log("ERROR ", err))

    const duelCount = await db
        .collection(`bucket_${DUEL_BUCKET}`)
        .find().count().catch(err => console.log("ERROR ", err))

    availableCount = Math.max(Number(duelCapacity.value) - Number(duelCount), 0)

    if ((users.length == 2 && availableCount < 2) || (users.length == 1 && availableCount < 1)) {
        return res.status(200).send({
            message: "Server is not available"
        });
    } else if (users.length == 2) {
        const duel_id = await createDuel(data);

        for (let user of users) {
            let newToken = await createIdentity(user, duel_id);
            console.log("newToken", newToken)
            tokens.push(newToken)
        }
        return res.status(200).send({
            message: "Server is available",
            tokens: tokens,
            duel_id: duel_id
        });
    } else if (users.length == 1) {
        const duel_id = await createDuel(data);

        let newToken = await createIdentity(users[0], duel_id);
        tokens.push(newToken)
        
        return res.status(200).send({
            message: "Server is available",
            tokens: tokens,
            duel_id: duel_id
        });
    } else {
        return res.status(400).send({
            message: "Unexpected case",
        });
    }
}

async function createDuel(data) {
    if (!db) {
        db = await database().catch(err => console.log("ERROR 2", err));
    }

    data['created_at'] = new Date(data['created_at']);

    const duelData = await db
        .collection(`bucket_${DUEL_BUCKET}`)
        .insertOne(data).catch(err => console.log("ERROR ", err))

    return duelData.ops[0]._id
}

async function createIdentity(user_id, duel_id) {
    Identity.initialize({ apikey: `${SECRET_API_KEY}` });
    let msisdn = `1111${msisdnGenerate(6)}`;

    await Identity.insert({
        identifier: msisdn,
        password: PASSWORD_SALT,
        policies: [`${USER_POLICY}`],
        attributes: { msisdn: msisdn, user_id: user_id, duel_id: duel_id }
    }).catch(err => console.log("ERROR ", err))

    const token = await Identity.login(msisdn, PASSWORD_SALT).catch(err => console.log("ERROR ", err))

    return token
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
