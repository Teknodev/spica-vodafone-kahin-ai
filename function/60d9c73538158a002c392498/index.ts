import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

const MATCHMAKING_BUCKET = VARIABLE.BUCKET.MATCHMAKING;
const USER_BUCKET = VARIABLE.BUCKET.USER;
const BOT_BUCKET = VARIABLE.BUCKET.BOT;
const SERVER_INFO_BUCKET = VARIABLE.BUCKET.SERVER_INFO;

export async function matchmaker() {
    const db = await Api.useDatabase();
    const matchmakingCollection = db.collection(`bucket_${MATCHMAKING_BUCKET}`);
    const userCollection = db.collection(`bucket_${USER_BUCKET}`);
    const botCollection = db.collection(`bucket_${BOT_BUCKET}`);

    setInterval(async () => {
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

        if (match_making_users.length) {
            console.log("@match_making_users: ", match_making_users)
        }

        let { matched_with_user, matched_with_bots } = seperateMatchingsUsers([
            ...match_making_users
        ]);

        // 1 - add mathced users to ->> duel ->> delete from ->> matchmaking bucket
        let duels_with_user_array = createDuelObjectsWithUser([...matched_with_user]);
        if (duels_with_user_array.length > 0) {
            requestForANewGame(duels_with_user_array[0]);
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
            requestForANewGame(duels_with_bots_array[0]);
        }

        let delete_match_with_bot_filter = nonMatchedWithUserDeleteFilter([...matched_with_bots]);
        await matchmakingCollection.deleteMany(
            delete_match_with_bot_filter
        );
    }, 5000);
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
            user1_life: 3,
            user2_life: 3,
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
            user1_life: 3,
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

    // --set unmatched
    for (let matchmaking_user of matchmaking_users) {
        if (!inMatched(matchmaking_user, matched)) {
            unmatched.push(matchmaking_user);
        }
    }

    return {
        matched_with_user: matched,
        matched_with_bots: unmatched
    };
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

async function requestForANewGame(data) {
    data["user1"] = String(data.user1);
    data["user2"] = String(data.user2);

    const users = [String(data.user1)];
    if (data.player_type == 0) {
        users.push(String(data.user2));
    }

    // !TODO should send this request to the message broker
    // https://vodafone.queue.spicaengine.com/message?topic_id=657310d3f1bac9002c940b22
    // https://vodafone-sayi-krali-a4d57.hq.spicaengine.com/api/fn-execute/new-game-listener
    Api.httpRequest('post', 'https://vodafone-sayi-krali-a4d57.hq.spicaengine.com/api/fn-execute/new-game-listener', {
        "referenceNo": String(Date.now()),
        "service": "sayi_krali",
        "data": data,
        "users": users
    }, {}).catch(err => console.log("ERR: ", err));
}

export async function assignDuel(req, res) {
    const { referenceNo, duelId, duelData, tokens, serverName } = req.body;

    const isAssigned = await Api.getOne(SERVER_INFO_BUCKET, { reference_no: referenceNo });
    if (isAssigned) {
        return res.status(200).send({ canContinue: false })
    }

    try {
        await insertServerInfo(duelData, duelId, tokens, referenceNo, serverName)
        return res.status(200).send({ canContinue: true })
    } catch (err) {
        return res.status(200).send({ canContinue: false })
    }
}

function insertServerInfo(duelData, duelId, tokens, referenceNo, serverName) {
    console.log("duelData: ", duelData)
    const insertedObj = {
        duel_id: duelId,
        match_server: serverName,
        user1: duelData["user1"],
        user1_token: tokens[0],
        user2: duelData["user2"],
        user2_token: tokens[1] || "",
        available_to_user_1: true,
        available_to_user_2: true,
        created_at: new Date(),
        user1_ready: false,
        user2_ready: tokens[1] ? false : true,
        reference_no: referenceNo
    };

    return Api.insertOne(SERVER_INFO_BUCKET, insertedObj).catch(err => console.log(err))
}