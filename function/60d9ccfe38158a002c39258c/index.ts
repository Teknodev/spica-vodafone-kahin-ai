import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as Tcell from "../../63b6d60cebfd83002c5e1966/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

const BUGGED_REWARD_BUCKET = VARIABLE.BUCKET.BUGGED_REWARD;
const MANUALLY_REWARD_BUCKET = VARIABLE.BUCKET.MANUALLY_REWARD;

const CAMPAIGN_ID = VARIABLE.TCELL.CAMPAIGN_ID;
const VARIANT_ID = VARIABLE.TCELL.VARIANT_ID;
const OFFER_ID_1GB = VARIABLE.TCELL.OFFER_ID_1GB;

const TCELL_USERNAME = VARIABLE.TCELL.USERNAME;
const TCELL_PASSWORD = VARIABLE.TCELL.PASSWORD;


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