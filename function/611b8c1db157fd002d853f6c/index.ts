import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as Environment from "../../63b57e98ebfd83002c5df0c5/.build";
import * as Helper from "../../633bf949956545002c9b7e31/.build";

const DUEL_BUCKET = Environment.env.BUCKET.DUEL;
const USER_BUCKET = Environment.env.BUCKET.USER;

export async function playCountDecrease(req, res) {
    const { userId } = req.body;

    const token = Helper.getTokenByReq(req);
    const decodedToken = await Helper.getDecodedToken(token)
    if (!decodedToken) {
        return res.status(400).send({ message: "Token is not verified." });
    }

    const user = await Api.getOne(USER_BUCKET, { _id: Api.toObjectId(userId) });
    let setQuery = {
        available_play_count: Math.max(
            user.available_play_count - 1,
            0
        )
    }

    if (user.free_play) {
        setQuery = { free_play: false }
    }

    await Api.updateOne(USER_BUCKET, { _id: Api.toObjectId(userId) }, { $set: setQuery })

    return res.status(200).send({ message: "successful" });

}

export async function setReady(req, res) {
    const { duelId, user_placement } = req.body;

    const token = Helper.getTokenByReq(req);
    const decodedToken = await Helper.getDecodedToken(token)
    if (!decodedToken) {
        return res.status(400).send({ message: "Token is not verified." });
    }

    await Api.updateOne(DUEL_BUCKET, { _id: Api.toObjectId(duelId) }, {
        $set: {
            [user_placement]: true
        }
    })

    return res.status(200).send({ message: "successful" });
}

export async function changeAvatar(req, res) {
    const { userId, avatarId } = req.body;

    const token = Helper.getTokenByReq(req);
    const decodedToken = await Helper.getDecodedToken(token)
    if (!decodedToken) {
        return res.status(400).send({ message: "Token is not verified." });
    }

    await Api.updateOne(USER_BUCKET, { _id: Api.toObjectId(userId) }, {
        $set: { avatar_id: avatarId }
    })

    return res.status(200).send({ message: "successful" });
}

export async function changeName(req, res) {
    const { userId, name } = req.body;

    const token = Helper.getTokenByReq(req);
    const decodedToken = await Helper.getDecodedToken(token)
    if (!decodedToken) {
        return res.status(400).send({ message: "Token is not verified." });
    }

    await Api.updateOne(USER_BUCKET, { _id: Api.toObjectId(userId) }, {
        $set: { name: name }
    })

    return res.status(200).send({ message: "successful" });
}