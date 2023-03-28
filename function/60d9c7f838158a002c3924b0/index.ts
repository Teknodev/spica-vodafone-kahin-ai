import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as Environment from "../../63b57e98ebfd83002c5df0c5/.build";
import * as User from "../../63b6a403ebfd83002c5e104e/.build";

const PAST_MATCH_BUCKET = Environment.env.BUCKET.PAST_MATCH;
const SERVER_INFO_BUCKET = Environment.env.BUCKET.SERVER_INFO;

const OPERATION_KEY = Environment.env.OPERATION_KEY;

export async function insertPastMatchFromServer(req, res) {
    const { duel, key } = req.body;

    if (key != OPERATION_KEY) {
        return res.status(400).send({ message: "No access" });
    }

    removeServerInfo(duel._id);

    const user1 = await User.getOne({ _id: Api.toObjectId(duel.user1) })
    const user2 = await User.getOne({ _id: Api.toObjectId(duel.user2) })

    let user1EarnedAward = 0;
    let user2EarnedAward = 0;

    if (duel.user1_points == duel.user2_points) {
        duel.winner = 3;
        duel.user1_points += 100;
        duel.user2_points += 100;
        user1.win_count += 1;
        user1EarnedAward += duel.user1_is_free ? 1 : 2;

        if (!user2.bot) {
            user2EarnedAward += duel.user2_is_free ? 1 : 2;
            user2.win_count += 1;
        }
    } else if (duel.user1_points > duel.user2_points) {
        duel.winner = 1;
        duel.user1_points += 100;
        user1.win_count += 1;
        user1EarnedAward += duel.user1_is_free ? 1 : 2;

        if (!user2.bot) {
            user2EarnedAward += duel.user2_is_free ? 0 : 1;
            user2.lose_count += 1;
        }
    } else if (duel.user1_points < duel.user2_points) {
        duel.winner = 2;
        duel.user2_points += 100;
        if (!user2.bot) {
            user2.win_count += 1;
            user2EarnedAward += duel.user2_is_free ? 1 : 2;
        }
        user1.lose_count += 1;
        user1EarnedAward += duel.user1_is_free ? 0 : 1;
    }

    await Api.insertOne(PAST_MATCH_BUCKET, {
        duel_id: duel.duel_id,
        name: user1.name + " vs " + user2.name,
        user1: duel.user1,
        user2: duel.user2,
        winner: duel.winner,
        user1_answers: duel.user1_answers,
        user2_answers: duel.user2_answers,
        user1_points: duel.user1_points,
        user2_points: duel.user2_points,

        start_time: Api.toObjectId(duel._id).getTimestamp(),
        end_time: new Date(),
        player_type: duel.player_type,
        points_earned: duel.user1_points + duel.user2_points,
        user1_is_free: duel.user1_is_free,
        user2_is_free: duel.user2_is_free,
    })

    User.updateOne({ _id: Api.toObjectId(duel.user1) }, {
        $set: {
            total_point: parseInt(user1.total_point) + duel.user1_points,
            weekly_point: user1.weekly_point + duel.user1_points,
            win_count: user1.win_count,
            lose_count: user1.lose_count,
            total_award: parseInt(user1.total_award) + user1EarnedAward,
            weekly_award: (user1.weekly_award || 0) + user1EarnedAward,
        }
    })

    User.updateOne({ _id: Api.toObjectId(duel.user2) }, {
        $set: {
            total_point: parseInt(user2.total_point) + duel.user2_points,
            weekly_point: user2.weekly_point + duel.user2_points,
            win_count: user2.win_count,
            lose_count: user2.lose_count,
            total_award: parseInt(user2.total_award) + user2EarnedAward,
            weekly_award: (user2.weekly_award || 0) + user2EarnedAward,
        }
    })

    return res.status(200).send({ message: "successful" });
}

export async function removeServerInfoExternal(req, res) {
    const { duel, key } = req.body;

    if (key != OPERATION_KEY) {
        return res.status(400).send({ message: "No access" });
    }
    removeServerInfo(String(duel._id));
}

async function removeServerInfo(duel_id) {
    Api.deleteOne(SERVER_INFO_BUCKET, { duel_id: duel_id })
}