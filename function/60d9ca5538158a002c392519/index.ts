import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as Helper from "../../633bf949956545002c9b7e31/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

const USER_BUCKET = VARIABLE.BUCKET.USER;
const MATCHMAKING_BUCKET = VARIABLE.BUCKET.MATCHMAKING;

export async function addMatchMaking(req, res) {
    const { token } = req.body;
    
    const decodedToken = await Helper.getDecodedToken(token)
    if (!decodedToken) {
        return res.status(400).send({ message: "Token is not verified." });
    }

    const userObj = await Api.getOne(USER_BUCKET, { identity: decodedToken._id })
   
    if (userObj.available_play_count > 0 || userObj.free_play) {
        let currentDate = new Date(Date.now()).toISOString();

        await Api.insertOne(MATCHMAKING_BUCKET, {
            user: userObj._id,
            date: currentDate,
            title: 'matchmaking'
        })

        const matchmakingObj = await Api.getOne(MATCHMAKING_BUCKET, { user: userObj._id })

        return res.status(200).send({ matchmaking_object: matchmakingObj });
    }

    return res.status(400).send({ message: "User has no available games" });
}