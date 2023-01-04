import { database, ObjectId } from "@spica-devkit/database";
const jwt_decode = require("jwt-decode");

const USER_BUCKET_ID = process.env.USER_BUCKET_ID;
const CONFIRMATION_CODE_BUCKET_ID = process.env.CONFIRMATION_CODE_BUCKET_ID;


let db;

export async function getUserRank(req, res) {
    let token = req.headers.get("authorization").split(" ")[1];
    let userPoint;
    if (!db) {
        db = await database();
    }
    const users_collection = db.collection(`bucket_${USER_BUCKET_ID}`);

    let decoded_token = jwt_decode(token);
    let identity_id = decoded_token._id;
    let request = await users_collection
        .findOne({ identity: identity_id })
        .catch(err => console.log("ERROR 1", err));
    if (!request._id) return res.status(400).send({ error: request });
    // user_id = request._id;
    userPoint = request.weekly_point;

    const userCollection = db.collection(`bucket_${USER_BUCKET_ID}`);
    let userRank = await userCollection.find({ weekly_point: { $gte: userPoint } }).count();

    return res.status(200).send({ rank: userRank });
}

export async function getLeaderUsers(req, res) {
    if (!db) {
        db = await database();
    }
    const users_collection = db.collection(`bucket_${USER_BUCKET_ID}`);
    let leaders = await users_collection
        .find().sort({ weekly_point: -1 }).limit(10).toArray()
        .catch(err => console.log("ERROR 2", err));


    return res.status(200).send(leaders);
}

export async function manuallySendDrawFn(req, res) {
    if (!db) {
        db = await database();
    }
    const charge_collection = db.collection(`bucket_60ab7235c03a2d002eb2f574`);

    const chargeData = await charge_collection.find({ date: { $gte: new Date("04-19-2022 09:00:0"), $lt: new Date("04-19-2022 14:14:00") }, status: true }).toArray().catch(err => console.log("ERROR 1", err));
    console.log("chargeData", chargeData.length)

    const result = [];
    chargeData.forEach((el) => {
        result.push(
            {
                "Service": "4 Islem Bol GB",
                "OfferId": 4689,
                "Action": "Payment",
                "Msisdn": el.msisdn,
                "ChargeId": String(el._id),
                "Point": 100,
                "ChargeDate": el.date
            }
        )
    })
    return { result }
}