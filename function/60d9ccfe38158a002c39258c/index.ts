import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

const REWARD_QUEUE_BUCKET = VARIABLE.BUCKET.REWARD_QUEUE;

export async function applyRewardManually(change) {
    let msisdn = change.current.msisdn;
    if (!msisdn) return;

    if (msisdn.startsWith("90")) {
        msisdn = msisdn.substring(2)
    }

    Api.insertOne(REWARD_QUEUE_BUCKET, {
        msisdn,
        created_at: new Date(),
        next_try_date: new Date(),
        txn_id: String(Date.now()),
        purpose: change.current.purpose
    })
}