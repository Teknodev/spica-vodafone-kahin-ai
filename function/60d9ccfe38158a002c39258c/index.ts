import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as Tcell from "../../63b6d60cebfd83002c5e1966/.build";
import * as User from "../../63b6a403ebfd83002c5e104e/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

const BUGGED_REWARD_BUCKET = VARIABLE.BUCKET.BUGGED_REWARD;
const MANUALLY_REWARD_BUCKET = VARIABLE.BUCKET.MANUALLY_REWARD;

const PRODUCT_DAILY = VARIABLE.TCELL.PRODUCT_DAILY;
const CAMPAIGN_ID = VARIABLE.TCELL.CAMPAIGN_ID;
const VARIANT_ID = VARIABLE.TCELL.VARIANT_ID;
const OFFER_ID_1GB = VARIABLE.TCELL.OFFER_ID_1GB;

const TCELL_USERNAME = VARIABLE.TCELL.USERNAME;
const TCELL_PASSWORD = VARIABLE.TCELL.PASSWORD;

export async function getWinner(change) {
    const traget = change.document;

    const winnerOrder = traget.winner;
    const user1 = traget.user1;
    const user2 = traget.user2;

    let bot_id = "";
    let msisdns = [];
    let winners = [];
    let users = [user1, user2];

    const resUsers = await getUsersData(users).catch(err => console.log("ERROR 14", err));
    msisdns = resUsers.msisdns;
    bot_id = resUsers.bot_id;

    switch (winnerOrder) {
        case 1:
            winners = [user1];
            break;
        case 2:
            if (user2 != bot_id) winners = [user2];
            break;
        case 3:
            winners = [user1];
            if (user2 != bot_id) winners = [user1, user2];
            break;
        default:
            break;
    }

    // switch (winners.length) {
    //     case 1:
    //         if (users[0] == winners[0]) {
    //             setAward(msisdns, 0, traget._id);
    //         } else {
    //             setAward(msisdns, 1, traget._id);
    //         }
    //         break;
    //     case 2:
    //         setAward(msisdns, 0, traget._id);
    //         setAward(msisdns, 1, traget._id);
    //         break;
    //     default:
    //         break;
    // }
}

async function getUsersData(users) {
    const db = await Api.useDatabase();
    const identityCollection = db.collection(`identity`);

    let bot_id = "";
    let msisdns = [];

    const user1 = await User.getOne({ _id: Api.toObjectId(users[0]) })
    const user2 = await User.getOne({ _id: Api.toObjectId(users[1]) })

    const user1Identity = await identityCollection
        .findOne({ _id: Api.toObjectId(user1.identity) })
        .catch(err => console.log("ERROR 25 ", err));

    msisdns.push(user1Identity.attributes.msisdn);

    if (user2.bot) {
        bot_id = user2._id;
    }

    if (user2.bot == false) {
        const user2Identity = await identityCollection
            .findOne({ _id: Api.toObjectId(user2.identity) })
            .catch(err => console.log("ERROR 26 ", err));

        msisdns.push(user2Identity.attributes.msisdn);
    } else {
        bot_id = user2._id;
    }

    return { msisdns: msisdns, bot_id: bot_id };
}


export async function applyRewardManually(change) {
    const sessionId = await Tcell.getSessionId(TCELL_USERNAME, TCELL_PASSWORD, VARIANT_ID);

    let awardRes;
    let matchID = "";

    if (change.current.retry_id) {
        const rewardData = await Api.getOne(BUGGED_REWARD_BUCKET, {
            _id: Api.toObjectId(change.current.retry_id)
        })
        matchID = rewardData.match_id;
    }

    try {
        awardRes = await Tcell.setAward(sessionId, change.current.msisdn, OFFER_ID_1GB, CAMPAIGN_ID);
        if (awardRes) {
            Tcell.handleAwardResData(awardRes.data, matchID, 'manual');
        }
    } catch (err) {
        console.log("AWARD ERR: ", err)
    }

    Api.updateOne(MANUALLY_REWARD_BUCKET, { _id: Api.toObjectId(change.documentKey) }, {
        $set: { result: awardRes.data, process_completed: true }
    })
}