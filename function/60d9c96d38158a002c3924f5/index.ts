import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as Helper from "../../633bf949956545002c9b7e31/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

const USER_BUCKET = VARIABLE.BUCKET.USER;

export async function getUserRank(req, res) {
    const { token } = req.query;

    const decodedToken = await Helper.getDecodedToken(token)
    if (!decodedToken) {
        return res.status(400).send({ message: "Token is not verified." });
    }

    const userObj = await Api.getOne(USER_BUCKET, { identity: decodedToken._id })
    if (!userObj) {
        return res.status(400).send({ error: 'User not found' });
    }

    const userRank = await Api.getCountByFilter(USER_BUCKET, {
        range_point: { $gte: userObj.range_point }
    })

    return res.status(200).send({ rank: userRank });
}

export async function getLeaderUsers(req, res) {
    const db = await Api.useDatabase();
    const usersCollection = db.collection(`bucket_${USER_BUCKET}`);
    let leaders = await usersCollection
        .find().sort({ range_point: -1 }).limit(10).toArray()
        .catch(err => console.log("ERROR 2", err));

    return res.status(200).send(leaders);
}