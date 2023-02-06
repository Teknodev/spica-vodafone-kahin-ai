import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as Environment from "../../63b57e98ebfd83002c5df0c5/.build";

const USER_BUCKET = Environment.env.BUCKET.USER;
const CHARGE_BUCKET = Environment.env.BUCKET.CHARGE;
const PAST_MATCH_BUCKET = Environment.env.BUCKET.PAST_MATCH;
const BUGGED_REWARD_BUCKET = Environment.env.BUCKET.BUGGED_REWARD;
const PLAY_COUNT_LOG_BUCKET = Environment.env.BUCKET.PLAY_COUNT_LOG;
const MANUALLY_REWARD_BUCKET = Environment.env.BUCKET.MANUALLY_REWARD;

export async function checkReward() {
    await retryTcellIssues().catch(err => console.log("ERROR 13", err));
}

async function retryTcellIssues() {
    const db = await Api.useDatabase();
    const buggedRewardsCollection = db.collection(`bucket_${BUGGED_REWARD_BUCKET}`);
    const manuallyRewardsCollection = db.collection(`bucket_${MANUALLY_REWARD_BUCKET}`);
    const errors = ["3302", "3238", "3581", "3483"]; // TCELL ERROR

    let minDate = new Date();
    minDate.setMinutes(minDate.getMinutes() - 240);

    let buggedRewards = await buggedRewardsCollection
        .find({
            date: { $gte: minDate, $lt: new Date() },
            error_id: { $in: errors }
        })
        .toArray()
        .catch(err => console.log("ERROR 9 ", err));

    let buggedRewardsIds = Array.from(buggedRewards, x => x._id.toString());
    const manuallyRewards = await manuallyRewardsCollection
        .find({
            process_completed: true,
            retry_id: { $in: buggedRewardsIds }
        })
        .toArray()
        .catch(err => console.log("ERROR 14:", err));

    buggedRewards = buggedRewards.filter(
        reward => !manuallyRewards.find(mr => mr.retry_id == reward._id.toString())
    );

    const logData = [];
    for (let reward of buggedRewards) {
        let retryCount = await buggedRewardsCollection.find({
            $and: [
                { match_id: { $exists: true } },
                { match_id: { $ne: '' } },
                { match_id: reward.match_id }
            ]
        }).toArray();
        if (retryCount.length < 24) {
            logData.push({
                msisdn: reward.msisdn.substring(2),
            })
            insertReward(
                reward.msisdn.substring(2),
                "daily_1",
                reward._id
            );
        }
    }

    if (logData.length) {
        console.log("logData: ", logData)
    }
}

async function insertReward(msisdn, rewardType, retry_id = "") {
    const Bucket = Api.useBucket();
    await Bucket.data
        .insert(MANUALLY_REWARD_BUCKET, {
            msisdn: Number(msisdn),
            reward: rewardType,
            system: true,
            retry_id
        })
        .catch(err => console.log("ERROR 3: ", err));

    return true;
}

export async function detectUniqueCharges(req, res) {
    const db = await Api.useDatabase();

    let chargeCollection = db.collection(`bucket_60ab7235c03a2d002eb2f574`);
    let rewardsCollection = db.collection(`bucket_609669f805b0df002ceb2517`);

    let result = await chargeCollection
        .aggregate([
            { $match: { status: true } },
            { $group: { _id: "$msisdn", count: { $sum: 1 } } },
            { $match: { count: { "$gte": 10 } } }
        ])
        .toArray();
    result = result.map(r => {
        return { msisdn: r._id, count: r.count };
    });

    let msisdns = result.map(r => r.msisdn);


    let rewardsData = await rewardsCollection
        .aggregate([
            { $match: { msisdn: { $in: msisdns }, offer_id: 451319 } },
            { $group: { _id: "$msisdn", count: { $sum: 1 } } }
        ])
        .toArray();

    result.sort((a, b) => a.msisdn - b.msisdn);
    rewardsData.sort((a, b) => a._id - b._id);

    let total = 0;
    let warning = [];
    let max = 0;
    let min = 99;
    let diff = null;
    for (let userIndex in result) {
        diff = null;
        //result[userIndex] = { ...result[userIndex], ...userDatas[userIndex] };

        if (rewardsData[userIndex] && result[userIndex].count > rewardsData[userIndex].count) {
            warning.push(rewardsData[userIndex]);
            diff = result[userIndex].count - rewardsData[userIndex].count;
            total += diff;
        }

        if (diff && max < diff) {
            max = diff;
            if (max > 90)
                console.log(result[userIndex].count, rewardsData[userIndex].count, max, diff);
        }

        if (diff && min > diff) {
            min = diff;
        }
    }


    return { result, warning, results: result.length, warnings: warning.length, total, max, min };
}

export async function detectMissingAvailablePlay() {
    const db = await Api.useDatabase();

    const pastMatchesCollection = db.collection(`bucket_${PAST_MATCH_BUCKET}`);
    const chargeCollection = db.collection(`bucket_${CHARGE_BUCKET}`);
    const usersCollection = db.collection(`bucket_${USER_BUCKET}`);
    const playCountCollection = db.collection(`bucket_${PLAY_COUNT_LOG_BUCKET}`);
    const identityCollection = db.collection(`identity`);

    const uniqueMatches = [];
    const msisdns = [];
    const identitiesId = [];
    const resultArr = [];

    const minDate = new Date();
    minDate.setHours(minDate.getHours() - 2);

    const maxDate = new Date();
    maxDate.setMinutes(maxDate.getMinutes() - 10);

    const matchMaxDate = new Date();
    matchMaxDate.setMinutes(matchMaxDate.getMinutes() - 5);

    const chargeResult = await chargeCollection
        .aggregate([
            { $match: { status: true, date: { $gte: minDate, $lte: maxDate } } },
            { $group: { _id: "$msisdn", count: { $sum: 1 } } }
        ])
        .toArray();

    chargeResult.forEach(charge => {
        msisdns.push(charge._id.substr(2));
    });

    const identities = await identityCollection
        .find({ "attributes.msisdn": { $in: msisdns } })
        .toArray()
        .catch(err => console.log("ERROR 17", err));

    identities.forEach(identity => {
        identitiesId.push(String(identity._id));
    });

    const users = await usersCollection
        .find({ identity: { $in: identitiesId } })
        .toArray()
        .catch(err => console.log("ERROR 18", err));

    let user1Paid = await pastMatchesCollection
        .aggregate([
            { $match: { start_time: { $gte: minDate, $lte: matchMaxDate }, user1_is_free: false } },
            { $group: { _id: "$user1", count: { $sum: 1 } } }
        ])
        .toArray()
        .catch(err => console.log("ERROR 19", err));

    let user2Paid = await pastMatchesCollection
        .aggregate([
            {
                $match: {
                    start_time: { $gte: minDate, $lte: matchMaxDate },
                    user2_is_free: false,
                    player_type: 0
                }
            },
            { $group: { _id: "$user2", count: { $sum: 1 } } }
        ])
        .toArray()
        .catch(err => console.log("ERROR 20", err));

    let concatedMatches = user1Paid.concat(user2Paid);

    concatedMatches.reduce(function (res, value) {
        if (!res[value._id]) {
            res[value._id] = {
                _id: value._id,
                count: 0
            };
            uniqueMatches.push(res[value._id]);
        }
        res[value._id].count += value.count;
        return res;
    }, {});

    users.forEach(user => {
        let userIdeentity = identities.find(identity => String(identity._id) == user.identity);
        let userMatch = uniqueMatches.find(userMatch => userMatch._id == String(user._id));
        userIdeentity ? (user["msisdn"] = userIdeentity.attributes.msisdn) : undefined;
        userMatch ? (user["match_count"] = userMatch.count) : undefined;
    });


    const manuallyAdded = [];
    //console.log("chargeResult",chargeResult.length)
    chargeResult.forEach(charge => {
        let chargeUser = users.find(
            user => user.msisdn == charge._id.substr(2)
        );
        if (chargeUser) {
            let userMatchCount = chargeUser.available_play_count + (chargeUser.match_count || 0);
            if (charge.count > userMatchCount) {
                chargeUser["missing_play_count"] = charge.count - userMatchCount;
                manuallyAdded.push(chargeUser);
                resultArr.push({
                    _id: chargeUser._id,
                    msisdn: charge._id,
                    missing_play_count: charge.count - userMatchCount
                });
            }
        }
    });

    for (let user of manuallyAdded) {
        await usersCollection
            .updateOne(
                { _id: Api.toObjectId(user._id) },
                {
                    $inc: {
                        available_play_count: user.missing_play_count
                    }
                }
            )
            .catch(err => console.log("ERROR 21", err));
    }

    if (resultArr.length > 0) {
        let insertedData = {
            title: "Play Count",
            added_play_count: [],
            created_at: new Date(),
        }
        resultArr.forEach(el => {
            insertedData.added_play_count.push({
                missing_play_count: el.missing_play_count,
                msisdn: el.msisdn
            })
        })
        await playCountCollection.insertOne(insertedData).catch(err => console.log("ERR", err))
        console.log("Manually Added Play Count: ", resultArr);
    }


}