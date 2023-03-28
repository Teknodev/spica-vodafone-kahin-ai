import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as User from "../../63b6a403ebfd83002c5e104e/.build";
import * as Helper from "../../633bf949956545002c9b7e31/.build";
import * as Environment from "../../63b57e98ebfd83002c5df0c5/.build";

const SERVER_INFO_BUCKET = Environment.env.BUCKET.SERVER_INFO;
const OPERATION_KEY = Environment.env.OPERATION_KEY;

export async function setReadyMainServer(req, res) {
    const { userId, duelId, key } = req.body;

    if (key != OPERATION_KEY) {
        return res.status(400).send({ message: "No access" });
    }

    await changeServerAvailabilityToUser(userId, duelId, "ready");
    return res.status(200).send({ message: "successful" });
}

export async function serverInfoUpdate(req, res) {
    const { userId, duelId, key } = req.body;

    if (key != OPERATION_KEY) {
        return res.status(400).send({ message: "No access" });
    }

    await changeServerAvailabilityToUser(userId, duelId, "infoupdate");
    return res.status(200).send({ message: "successful" });
}

export async function playCountDecrease(req, res) {
    const { userId } = req.body;

    const user = await User.getOne({ _id: Api.toObjectId(userId) })

    let setQuery = {
        available_play_count: Math.max(user.available_play_count - 1, 0)
    };

    if (user.free_play) {
        setQuery = { free_play: false }
    }

    await User.updateOne({ _id: Api.toObjectId(userId) }, { $set: setQuery });

    return res.status(200).send({ message: "successful" });
}

export async function changeAvatar(req, res) {
    const { userId, avatarId } = req.body;

    const token = Helper.getTokenByReq(req);
    const decodedToken = await Helper.getDecodedToken(token)
    if (!decodedToken) {
        return res.status(400).send({ message: "Token is not verified." });
    }

    await User.updateOne({ _id: Api.toObjectId(userId) }, { $set: { avatar_id: avatarId } })

    return res.status(200).send({ message: "successful" });
}

export async function changeName(req, res) {
    const { userId, name } = req.body;

    const token = Helper.getTokenByReq(req);
    const decodedToken = await Helper.getDecodedToken(token)
    if (!decodedToken) {
        return res.status(400).send({ message: "Token is not verified." });
    }

    await User.updateOne({ _id: Api.toObjectId(userId) }, { $set: { name: name } })

    return res.status(200).send({ message: "successful" });
}

async function changeServerAvailabilityToUser(userId, duelId, type) {
    const serverInfo = await Api.getOne(SERVER_INFO_BUCKET, { duel_id: duelId });

    if (!serverInfo) return;

    let userPlacement = 1;
    if (serverInfo.user2 == userId) {
        userPlacement = 2;
    }

    let setQuery = {};
    switch (type) {
        case "infoupdate":
            setQuery = { $set: { [`available_to_user_${userPlacement}`]: false } };
            break;
        case "ready":
            setQuery = { $set: { [`user${userPlacement}_ready`]: true } };
            break;
        default:
            break;
    }

    await Api.updateOne(SERVER_INFO_BUCKET, { duel_id: duelId }, setQuery);
    return true;
}