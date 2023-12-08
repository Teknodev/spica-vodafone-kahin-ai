import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as User from "../../63b6a403ebfd83002c5e104e/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

const PAST_MATCH_BUCKET = VARIABLE.BUCKET.PAST_MATCH;
const SERVER_INFO_BUCKET = VARIABLE.BUCKET.SERVER_INFO;
const OPERATION_KEY = VARIABLE.OPERATION_KEY;

export async function insertPastMatchFromServer(req, res) {
    const { duel, key } = req.body;

    if (key != OPERATION_KEY) {
        return res.status(400).send({ message: "No access" });
    }

    removeServerInfo(duel._id);

    const user1 = await User.getOne({ _id: Api.toObjectId(duel.user1) })
    const user2 = await User.getOne({ _id: Api.toObjectId(duel.user2) })

    let user1DailyPoint = 0;
    let user2DailyPoint = 0;

    if (duel.user1_points == duel.user2_points) {
        duel.winner = 3;
        user1.win_count += 1;
        user1DailyPoint = 100;

        if (!user2.bot) {
            user2.win_count += 1;
            user2DailyPoint = 100;
        }
    } else if (duel.user1_points > duel.user2_points) {
        duel.winner = 1;
        user1.win_count += 1;
        user1DailyPoint = 100;

        if (!user2.bot) {
            user2.lose_count += 1;
            user2DailyPoint = 50;
        }
    } else if (duel.user1_points < duel.user2_points) {
        duel.winner = 2;
        if (!user2.bot) {
            user2.win_count += 1;
            user2DailyPoint = 100;
        }
        user1.lose_count += 1;
        user1DailyPoint = 50;
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
        start_time: duel.start_time,
        end_time: new Date(),
        player_type: duel.player_type,
        points_earned: duel.user1_points + duel.user2_points,
    })

    updateUser(1, user1, user1DailyPoint, duel)
    updateUser(2, user2, user2DailyPoint, duel)

    return res.status(200).send({ message: "successful" });
}

function updateUser(userIndex, user, dailyPoint, duel) {
    let rangeRewardCount = user.range_reward_count;
    const totalPoint = parseInt(user.total_point);
    const result = Math.floor(totalPoint + dailyPoint / 1000);
    if (result > rangeRewardCount) {
        // TODO set reward
        setReward()
        rangeRewardCount += 1;
    }

    User.updateOne({ _id: Api.toObjectId(duel[`user${userIndex}`]) }, {
        $set: {
            total_point: totalPoint + dailyPoint,
            range_point: user.range_point + dailyPoint,
            range_reward_count: rangeRewardCount,
            win_count: user.win_count,
            lose_count: user.lose_count,
        }
    })
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

function setReward(){}