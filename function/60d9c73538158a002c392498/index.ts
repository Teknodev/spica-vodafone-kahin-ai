import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as Environment from "../../63b57e98ebfd83002c5df0c5/.build";

const MATCHMAKING_BUCKET = Environment.env.BUCKET.MATCHMAKING;
const USER_BUCKET = Environment.env.BUCKET.USER;
const BOT_BUCKET = Environment.env.BUCKET.BOT;
const SERVER_INFO_BUCKET = Environment.env.BUCKET.SERVER_INFO;

const MATCH_SERVERS = [
    { title: 'bip-4islem-d6738', api_key: '406bus18l2yiufdq' },
]

export async function matchmaker() {
    const db = await Api.useDatabase();
    const matchmakingCollection = db.collection(`bucket_${MATCHMAKING_BUCKET}`);
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

    let { matched_with_user, matched_with_bots } = seperateMatchingsUsers([
        ...match_making_users
    ]);

    // 1 - add mathced users to ->> duel ->> delete from ->> matchmaking bucket
    let duels_with_user_array = createDuelObjectsWithUser([...matched_with_user]);
    if (duels_with_user_array.length > 0) {
        checkAvailability(duels_with_user_array[0]);
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
        checkAvailability(duels_with_bots_array[0]);
    }

    let delete_match_with_bot_filter = nonMatchedWithUserDeleteFilter([...matched_with_bots]);
    await matchmakingCollection.deleteMany(
        delete_match_with_bot_filter
    );
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

// TODO
let _counter = 0;
async function checkAvailability(data) {
    data["user1"] = String(data.user1);
    data["user2"] = String(data.user2);
    let users = [String(data.user1)];

    if (data.player_type == 0) {
        users.push(String(data.user2));
    }

    _counter++;

    let _tempCounter = _counter;
    let postData = {
        data: data,
        users: users,
        code: _counter
    };

    let serverIndex = 0;
    // if (_counter % 2 == 0) {
    //     serverIndex = 1;
    // }

    let server = MATCH_SERVERS[serverIndex].title;
    let api_key = MATCH_SERVERS[serverIndex].api_key;

    let url = `https://${server}.hq.spicaengine.com/api/fn-execute/checkAvailability`;

    const headers = {
        Authorization: `APIKEY ${api_key}`,
        "Content-Type": "application/json"
    };

    let serverRes;
    try {
        serverRes = await Api.httpRequest('post', url, postData, headers);
    } catch (err) {
        console.log(`AXIOS ERR: code: ${_tempCounter} ------`, server, 'ERR: ', err)
        return;
    }

    if (serverRes && serverRes.status != 200) {
        console.log("serverRes: ", serverRes)
    }

    if (serverRes && serverRes.data.tokens && serverRes.data.tokens[0]) {
        let insertedObj = {
            duel_id: serverRes.data.duel_id,
            match_server: server,
            user1: data["user1"],
            user1_token: serverRes.data.tokens[0],
            user2: data["user2"],
            user2_token: serverRes.data.tokens[1] || "",
            available_to_user_1: true,
            available_to_user_2: true,
            created_at: new Date(),
            user1_ready: false,
            user2_ready: serverRes.data.tokens[1] ? false : true
        };

        await Api.insertOne(SERVER_INFO_BUCKET, insertedObj)
    }
}