import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as Environment from "../../63b57e98ebfd83002c5df0c5/.build";
import * as Helper from "../../633bf949956545002c9b7e31/.build";

const USER_BUCKET = Environment.env.BUCKET.USER;
const MATCHMAKING_BUCKET = Environment.env.BUCKET.MATCHMAKING;

export async function addMatchMaking(req, res) {
    const token = Helper.getTokenByReq(req);
    const decodedToken = await Helper.getDecodedToken(token)
    if (!decodedToken) {
        return res.status(400).send({ message: "Token is not verified." });
    }

    const { user } = req.body;

    const userObj = await Api.getOne(USER_BUCKET, { identity: decodedToken._id })

    if (userObj._id != user) {
        return res.status(400).send({ message: "Invalid operation for current user." });
    }

    if (userObj.available_play_count > 0 || userObj.free_play) {
        let currentDate = new Date(Date.now()).toISOString();

        await Api.insertOne(MATCHMAKING_BUCKET, {
            user,
            date: currentDate,
            title: 'matchmaking'
        })

        const matchmakingObj = await Api.getOne(MATCHMAKING_BUCKET, { user })

        return res.status(200).send({ matchmaking_object: matchmakingObj });
    }

    return res.status(400).send({ message: "User has no available games" });
}