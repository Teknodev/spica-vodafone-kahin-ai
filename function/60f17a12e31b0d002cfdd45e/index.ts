import { database, ObjectId } from "@spica-devkit/database";

const PAST_MATCHES_BUCKET_ID = process.env.PAST_MATCHES_BUCKET_ID;
const REWARD_LOGS_BUCKET_ID = process.env.REWARD_LOGS_BUCKET_ID;
const CHARGE_LOGS_BUCKET_ID = process.env.CHARGE_LOGS_BUCKET_ID;
const USER_BUCKET_ID = process.env.USER_BUCKET_ID;
const CONFIRMATION_CODES_BUCKET_ID = process.env.CONFIRMATION_CODES_BUCKET_ID;

export async function serverReady(req, res) {
    let db = await database();

    let bucketsObj = [
        { bucket: PAST_MATCHES_BUCKET_ID, field: "duel_id" },
        { bucket: PAST_MATCHES_BUCKET_ID, field: "user1" },
        { bucket: PAST_MATCHES_BUCKET_ID, field: "user2" },
        { bucket: REWARD_LOGS_BUCKET_ID, field: "msisdn" },
        { bucket: CHARGE_LOGS_BUCKET_ID, field: "msisdn" },
        { bucket: CONFIRMATION_CODES_BUCKET_ID, field: "msisdn" },
        { bucket: USER_BUCKET_ID, field: "identity" },
        { bucket: USER_BUCKET_ID, field: "weekly_point" }
    ];

    for (let obj of bucketsObj) {
        let filter = {};
        filter[obj.field] = 1;
        let indexes = await db.collection(`bucket_${obj.bucket}`).indexes();
        let isIndexExists = indexes.filter(index => index.name.includes(obj.field));
        console.log(obj.field, isIndexExists);
        if (!isIndexExists.length) {
            await db.collection(`bucket_${obj.bucket}`).createIndex(filter);
        }
    }

    return res.status(200).send("ok");
}

export async function getAllIndexes(req, res) {
    let db = await database();
    let indexes = await db.collection(`identity`).indexes();

    // let db = await database();
    // const allCollections = await db.listCollections().toArray().catch((err) => console.log(err))

    // let colNames = []
    // allCollections.forEach((el) => colNames.push(el.name))

    // const result = []
    // const colNames = ["strategy","bucket_60ab7235c03a2d002eb2f574","bucket_615191c237f1b4002ddcc260","storage","bucket_605ca275e9960e002c2781a4","bucket_616ffbb9bf2eef002e9b4602","bucket_608ac3061c4a8c002cba02a5","dashboard","apikey","activity","bucket_60d71e105181e4002c01fb06","function","webhook","bucket_60aa13679835cd002c1c9a1a","bucket_608a697abce757002c808288","buckets","bucket_616e782f9c4660002dd09ab1","objects","bucket_60b616c103f687002c65cf9a","bucket_614dc4c71796e3002e1161ea","function_logs","bucket_60b624726c7ed4002c5b96e5","preferences","bucket_61517461d0398a002e618021","bucket_60f16c6f29eb79002d0857dc","bucket_60d19214748275002c17ff18","bucket_6067935ee9960e002c27877f","bucket_60bf26f4c48b36002dd87e00","status","bucket_608bb7901c4a8c002cba4092","bucket_60d0b05b748275002c17fb50","bucket_60bf26f4c48b36002dd87e01","bucket_606c138f6b2647002c2fc497","identity","bucket_609669f805b0df002ceb2517","bucket_60742ed3f95e39002c4917ae","bucket_607808eba04c51002d25a007","bucket_60d71e805181e4002c01fb46","bucket_614dc4691796e3002e115e7d","policies","webhook_logs","bucket_60f16c6f29eb79002d0857db","bucket_60d71eff5181e4002c01fbcf","bucket_605c9480e9960e002c278191","bucket_60c39ef7ab3dbe002dfefa02","bucket_60c3a68ef30c8a002de50f27","bucket_60d19060748275002c17ff0e"]
    // for (let col of colNames) {
    //     let indexes = await db.collection(col).indexes();
    //     result.push({
    //         name: col,
    //         indexes: indexes
    //     })
    // }

    return res.status(200).send({ colNames: indexes })
}