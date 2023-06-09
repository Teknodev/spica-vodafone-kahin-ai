import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as Environment from "../../63b57e98ebfd83002c5df0c5/.build";

const USER_BUCKET = Environment.env.BUCKET.USER;
const CHARGE_BUCKET = Environment.env.BUCKET.CHARGE;
const REWARD_BUCKET = Environment.env.BUCKET.REWARD;
const PAST_MATCH_BUCKET = Environment.env.BUCKET.PAST_MATCH;
const BUGGED_REWARD_BUCKET = Environment.env.BUCKET.BUGGED_REWARD;
const PLAY_COUNT_LOG_BUCKET = Environment.env.BUCKET.PLAY_COUNT_LOG;
const MANUALLY_REWARD_BUCKET = Environment.env.BUCKET.MANUALLY_REWARD;

const OFFER_ID_1GB = Environment.env.TCELL.OFFER_ID_1GB;

export async function checkReward() {
    await retryTcellIssues().catch(err => console.log("ERROR 13", err));
    await retryNonRewardedMatches().catch(err => console.log("ERROR 12", err));
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

export async function retryNonRewardedMatches() {
    console.log("@retryNonRewardedMatches")
    const db = await Api.useDatabase();

    const pastMatchesCollection = db.collection(`bucket_${PAST_MATCH_BUCKET}`);
    const rewardsCollection = db.collection(`bucket_${REWARD_BUCKET}`);
    const usersCollection = db.collection(`bucket_${USER_BUCKET}`);
    const identityCollection = db.collection(`identity`);
    let minDate = new Date();
    let maxDate = new Date();
    minDate.setMinutes(minDate.getMinutes() - 11);
    maxDate.setMinutes(maxDate.getMinutes() - 1);

    const usersArr = [];

    const duels = await pastMatchesCollection
        .find({
            end_time: {
                $gte: minDate,
                $lt: maxDate
            }
        })
        .toArray()
        .catch(err => console.log("ERROR 8 ", err));

    const rewards = await rewardsCollection
        .find({ date: { $gte: minDate, $lt: maxDate } })
        .toArray()
        .catch(err => console.log("ERROR 9 ", err));

    for (let duel of duels) {
        usersArr.push(Api.toObjectId(duel.user1));
        usersArr.push(Api.toObjectId(duel.user2));
    }

    const usersData = await usersCollection
        .find({ _id: { $in: usersArr } })
        .toArray()
        .catch(err => console.log("ERROR 10 ", err));

    const users = usersData.filter(user => !user.bot);
    const usersIdentities = Array.from(users, user => Api.toObjectId(user.identity))

    const identitiesData = await identityCollection
        .find({ _id: { $in: usersIdentities } })
        .toArray()
        .catch(err => console.log("ERROR 11 ", err));

    users.forEach(user => {
        user["msisdn"] = identitiesData.filter(
            idn => idn._id == user.identity
        )[0].attributes.msisdn;
    });

    let reward = [];
    for (let duel of duels) {
        let user2Data = usersData.find(user => {
            return user._id == duel.user2;
        });

        let usersMsisdn = [];
        let usersIsFree = [];
        let user = null;

        if (duel.winner == 1 || duel.winner == 3) {
            let tempUserMsisdn = users.find(user => {
                return user._id == duel.user1;
            }).msisdn;

            usersMsisdn.push(tempUserMsisdn)
            usersIsFree.push(duel.user1_is_free);
            user = duel.user1;
        }

        if ((duel.winner == 2 || duel.winner == 3) && !user2Data.bot) {
            let tempUserMsisdn = users.find(user => {
                return user._id == duel.user2;
            });
            tempUserMsisdn = tempUserMsisdn ? tempUserMsisdn.msisdn : "";

            usersMsisdn.push(tempUserMsisdn)
            usersIsFree.push(duel.user2_is_free);

            user = duel.user2;
        }

        for (const [index, msisdn] of usersMsisdn.entries()) {
            if (msisdn && user) {
                reward = rewards.find(el => {
                    return (
                        el.msisdn.includes(msisdn) &&
                        el.match_id == duel._id.toString() &&
                        el.offer_id == OFFER_ID_1GB
                        //(el.status == true || (el.status == false && errors.includes(el.error_id)))
                    );
                })
                    ? reward
                    : [
                        ...reward,
                        {
                            msisdn: msisdn,
                            reward: usersIsFree[index] ? "hourly_1" : "daily_1"
                        }
                    ];
            }
        }
    }

    if (reward.length) {
        console.log("NONE REWARDED", reward)
    }

    for (let rew of reward) {
        await insertReward(rew.substring(2), rew.reward);
    }

    return true
}
