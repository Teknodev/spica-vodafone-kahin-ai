import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as Environment from "../../63b57e98ebfd83002c5df0c5/.build";

const MATCHMAKING_BUCKET = Environment.env.BUCKET.MATCHMAKING;
const DUEL_BUCKET = Environment.env.BUCKET.DUEL;
const USER_BUCKET = Environment.env.BUCKET.USER;
const BOT_BUCKET = Environment.env.BUCKET.BOT;

export async function matchmaker() {
    const db = await Api.useDatabase();
    const matchmakingCollection = db.collection(`bucket_${MATCHMAKING_BUCKET}`);
    const duelCollection = db.collection(`bucket_${DUEL_BUCKET}`);
    const userCollection = db.collection(`bucket_${USER_BUCKET}`);
    const botCollection = db.collection(`bucket_${BOT_BUCKET}`);

    let match_making_users = await matchmakingCollection
        .aggregate([
            {
                $set: {
                    _id: {
                        $toString: "$_id"
                    },
                    user: {
                        $toObjectId: "$user"
                    }
                }
            },
            {
                $lookup: {
                    from: `bucket_${USER_BUCKET}`,
                    localField: "user",
                    foreignField: "_id",
                    as: "user"
                }
            },
            {
                $unwind: { path: "$user", preserveNullAndEmptyArrays: true }
            },
            {
                $set: {
                    "user._id": {
                        $toString: "$user._id"
                    }
                }
            }
        ])
        .toArray()
        .catch(err => console.log("ERROR 1", err));

    let { matched_with_user, unmatched_with_user } = seperateMatchingsUsers([
        ...match_making_users
    ]);

    let { matched_with_bots, unmatched_with_bots } = seperateMatchingWithBot([
        ...unmatched_with_user
    ]);

    // 1 - add mathced users to ->> duel ->> delete from ->> matchmaking bucket
    let duels_with_user_array = createDuelObjectsWithUser([...matched_with_user]);
    if (duels_with_user_array.length > 0) {
        await duelCollection.insertMany(duels_with_user_array);
    }

    let delete_match_with_user_filter = matchedWithUserDeleteFilter([...matched_with_user]);
    await matchmakingCollection.deleteMany(delete_match_with_user_filter);

    // 2 - get random bot ->> add matched users(matched with bot) to ->> duel ->> delete these users from ->> matchmaking bucket

    let randomBot = await botCollection
        .aggregate([{ $sample: { size: 1 } }])
        .toArray()
        .catch(err => console.log("ERROR", err));

    let bot = await userCollection
        .findOne({ _id: randomBot[0]._id })
        .catch(err => console.log("ERROR 2", err));


    let duels_with_bots_array = createDuelObjectsWithBot([...matched_with_bots], bot);
    if (duels_with_bots_array.length > 0) {
        await duelCollection.insertMany(duels_with_bots_array);
    }

    let delete_match_with_bot_filter = nonMatchedWithUserDeleteFilter([...matched_with_bots]);
    await matchmakingCollection.deleteMany(
        delete_match_with_bot_filter
    );

    // 3- change (time and) elo of unmatched ->> delete these users from ->> matchmaking bucket ->> insert updated users to ->> matchmaking bucket

    let delete_unmatch_with_bots_filter = nonMatchedWithUserDeleteFilter([
        ...unmatched_with_bots
    ]);

    await matchmakingCollection.updateMany(delete_unmatch_with_bots_filter, {
        $inc: { max_elo: 20, min_elo: -20 }
    });
}

// DATA MANIPULATION FUNCTIONS
function createDuelObjectsWithUser(matchmaking_users) {
    let duel_array = [];
    let current_date = new Date();

    for (const matchmaking_user of matchmaking_users) {
        duel_array.push({
            user1: matchmaking_user[0].user._id,
            user2: matchmaking_user[1].user._id,
            user1_ready: false,
            user2_ready: false,
            user1_ingame: false,
            user2_ingame: false,
            created_at: current_date,
            user1_is_free: matchmaking_user[0].user.free_play,
            user2_is_free: matchmaking_user[1].user.free_play,
            user1_life: matchmaking_user[0].user.free_play == true ? 0 : 3,
            user2_life: matchmaking_user[1].user.free_play == true ? 0 : 3,
            user1_points: 0,
            user2_points: 0,
            player_type: 0
        });
    }

    return duel_array;
}

function createDuelObjectsWithBot(matchmaking_users, bot) {
    let duel_array = [];
    let current_date = new Date();

    for (const matchmaking_user of matchmaking_users) {
        duel_array.push({
            user1: matchmaking_user.user._id,
            user2: bot._id,
            user1_ready: false,
            user2_ready: true,
            user1_ingame: false,
            user2_ingame: true,
            created_at: current_date,
            user1_is_free: matchmaking_user.user.free_play,
            user2_is_free: false,
            user1_life: matchmaking_user.user.free_play == true ? 0 : 3,
            user2_life: 3,
            user1_points: 0,
            user2_points: 0,
            player_type: 1
        });
    }

    return duel_array;
}

function matchedWithUserDeleteFilter(matched_with_users) {
    let in_array = [];

    for (const matched_with_user of matched_with_users) {
        in_array.push(Api.toObjectId(matched_with_user[0]._id));
        in_array.push(Api.toObjectId(matched_with_user[1]._id));
    }

    return {
        _id: {
            $in: in_array
        }
    };
}

function nonMatchedWithUserDeleteFilter(matchmaking_users) {
    let in_array = [];

    // use map please

    for (const matchmaking_user of matchmaking_users) {
        in_array.push(Api.toObjectId(matchmaking_user._id));
    }

    return {
        _id: {
            $in: in_array
        }
    };
}

// HELPER FUNCTIONs

function seperateMatchingsUsers(matchmaking_users) {
    let matched = [];
    let unmatched = [];

    // new method
    // --set matched
    for (let matchmaking_user1 of matchmaking_users) {
        // 1-if first user is matched
        if (!inMatched(matchmaking_user1, matched)) {
            for (let matchmaking_user2 of matchmaking_users) {
                // 2-if second user is matched
                if (
                    !inMatched(matchmaking_user2, matched) &&
                    matchmaking_user1._id != matchmaking_user2._id
                ) {
                    if (canMatched(matchmaking_user1, matchmaking_user2)) {
                        // 3-if both user not is matched
                        if (
                            !inMatched(matchmaking_user1, matched) &&
                            !inMatched(matchmaking_user2, matched)
                        ) {
                            matched.push([matchmaking_user1, matchmaking_user2]);
                        }
                    }
                }
            }
        }
    }

    // --set unmatched
    for (let matchmaking_user of matchmaking_users) {
        if (!inMatched(matchmaking_user, matched)) {
            unmatched.push(matchmaking_user);
        }
    }

    return {
        matched_with_user: matched,
        unmatched_with_user: unmatched
    };
}

function seperateMatchingWithBot(matchmaking_users) {
    let matched_with_bots = [];
    let unmatched_with_bots = [];

    // use find

    for (let matchmaking_user of matchmaking_users) {
        let now = new Date();
        let ending_time = new Date(matchmaking_user.date);

        // time passed
        if (ending_time < now) {
            //add with bots array and remove from unmatched users
            matched_with_bots.push(matchmaking_user);
            // matchmaking_users = removeObject(matchmaking_user, matchmaking_users);
        } else {
            unmatched_with_bots.push(matchmaking_user);
        }
    }

    return {
        matched_with_bots: matched_with_bots,
        unmatched_with_bots: unmatched_with_bots
    };
}

function removeObject(object, array) {
    let index = getIndexOfObject(object, array);
    if (index != -1) array.splice(index, 1);

    return array;
}

function getIndexOfObject(object, array) {
    var index = array
        .map(function (item) {
            return item._id;
        })
        .indexOf(object._id);

    return index;
}

//check user is in the already matched array or not
function inMatched(matchmaking_user, matched) {
    let response = false;

    /* user -> array find */
    // or use normal for and break when find it

    for (const match of matched) {
        if (match[0]._id == matchmaking_user._id || match[1]._id == matchmaking_user._id) {
            response = true;
            break;
        }
    }

    return response;
}

function canMatched(matchmaking_user1, matchmaking_user2) {
    let response;

    if (
        matchmaking_user1.min_elo <= matchmaking_user2.user.elo &&
        matchmaking_user2.user.elo <= matchmaking_user1.max_elo
    ) {
        response = true;
    } else {
        response = false;
    }

    return response;
}
