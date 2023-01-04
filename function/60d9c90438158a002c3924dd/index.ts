import { database, ObjectId } from "@spica-devkit/database";
import axios from 'axios';

const USER_BUCKET_ID = process.env.USER_BUCKET_ID;
const CONFIRMATION_CODE_BUCKET_ID = process.env.CONFIRMATION_CODE_BUCKET_ID;

export async function clearUserPoint() {
    console.log("@observer::clearUserPoint");
    const db = await database();
    await db.collection(`bucket_${USER_BUCKET_ID}`).updateMany({}, { $set: { weekly_point: 0, weekly_award: 0 } });
}

export async function clearBotPoint() {
    const db = await database();
    await db.collection(`bucket_${USER_BUCKET_ID}`).updateMany({ bot: true }, { $set: { weekly_point: 0, total_point: 0 } })
}

export async function updateConfirmCode() {
    let date = new Date()
    date.setMinutes(date.getMinutes() - 2)

    const db = await database();

    const confirmCodeCollection = db.collection(`bucket_${CONFIRMATION_CODE_BUCKET_ID}`);
    confirmCodeCollection.updateMany({
        sent_date: { $lt: date },
        $or: [{ is_expired: false }, { is_expired: { $exists: false } }]
    },
        { $set: { is_expired: true } })
        .catch(err => console.log("ERROR ", err))
}

export async function getLast3MonthsPlayUser(req, res) {
    const db = await database();

    /*
    const pastMatchescollection = db.collection(`bucket_60742ed3f95e39002c4917ae`);

    const userCollection = db.collection(`bucket_605c9480e9960e002c278191`);
    const identityCollection = db.collection(`identity`);

    
    const usersObjectArr = Array.from(LAST_30, el => ObjectId(el))
    const users = await userCollection.find({ _id: { $in: usersObjectArr } }).limit(75000).toArray().catch(console.error)

    const identites = Array.from(users, el => ObjectId(el.identity));
    const identitiesDatas = await identityCollection.find({ _id: { $in: identites } }).limit(75000).toArray().catch(console.error)

    const msisdns = Array.from(identitiesDatas, el => el.attributes.msisdn)

    console.log("RESULT_ARR", msisdns.length)
   */

    // let dateFilter1 = {
    //     $gte: new Date("09-15-2022 21:00:0"),
    //     $lt: new Date("10-15-2022 21:00:0")
    // };

    // let dateFilter2 = {
    //     $gte: new Date("10-15-2022 21:00:0"),
    //     $lt: new Date("11-15-2022 21:00:0")
    // };

    // const users1 = [];
    // const users2 = [];

    // const matches1 = await pastMatchescollection.find({
    //     end_time: dateFilter1
    // }).toArray().catch(console.error)

    // const matches2 = await pastMatchescollection.find({
    //     end_time: dateFilter2
    // }).toArray().catch(console.error)

    // matches1.forEach(el => {
    //     users1.push(el.user1)
    //     if (el.duel_type == 0) {
    //         users1.push(el.user2)
    //     }
    // })

    // matches2.forEach(el => {
    //     users2.push(el.user1)
    //     if (el.duel_type == 0) {
    //         users2.push(el.user2)
    //     }
    // })

    // const uniqueUsers1 = [...new Set(users1)];
    // const uniqueUsers2 = [...new Set(users2)];

    // const resultArr = []
    // uniqueUsers1.forEach(el => {
    //     if (!users2.includes(el)) {
    //         resultArr.push(el)
    //     }
    // })

    // console.log("users1", users1.length)
    // console.log("users2", users2.length)
    // console.log("uniqueUsers1", uniqueUsers1.length)
    // console.log("uniqueUsers2", uniqueUsers2.length)
    // console.log("resultArr", resultArr.length)


    return res.status(200).send({ message: msisdns })
}

export async function setMannualy50KPlayCount(req, res) {
    // const result = await axios.get('https://storage.googleapis.com/download/storage/v1/b/hq-math-tcell-c6415/o/63749260322049002cb98a33?alt=media')
    //     .catch(console.error)

    // let msisdnStr = result.data;

    // const msisdns = msisdnStr.replaceAll('\r', '').split('\n');
    // // console.log("msisdns", msisdns)

    // const db = await database();
    // const userCollection = db.collection(`bucket_605c9480e9960e002c278191`);

    // await userCollection.updateMany({ identity: { $in: IDENTITYES } }, { $set: { available_play_count: 1 } })
    // const users = await userCollection.find({ identity: { $in: IDENTITIES }, available_play_count: {$gte: 1} } ).toArray();
    // console.log("users", users.length)
    // const identities = Array.from(users, el => String(el.identity));
    // console.log("users", users)

    // const testArr = Array.from(IDENTITIES, el => ObjectId(el))
    // const identityCollection = db.collection(`identity`);
    // const identitiesData = await identityCollection.find({ "_id": { $in: testArr } }).toArray();
    // const msiisdns = Array.from(identitiesData, el => el.attributes.msisdn)
    // const identitiesData = await identityCollection.find({ "attributes.msisdn": { $in: msisdns } }).toArray();
    // console.log("identitiesData", identitiesData)
    // console.log("msiisdns", msiisdns.length)

    // const identities = Array.from(identitiesData, el => String(el._id));

    // console.log("identities.length", identities.length)
    // console.log("identities", identities)

    return res.status(200).send({ message: msiisdns })
}

export async function getDuelsDatas(req, res) {
    const db = await database();
    const duelsCollection = db.collection(`bucket_605ca275e9960e002c2781a4`);
    const datas = await duelsCollection.find().limit(100).toArray().catch(console.error)

    console.log("duelsCollection", datas.length)

    return res.status(200).send({ message: datas })
}