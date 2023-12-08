import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

const USER_BUCKET = VARIABLE.BUCKET.USER;

export async function clearBotPoint() {
    Api.updateMany(USER_BUCKET, { bot: true }, {
        $set: { range_point: 0, total_point: 0 }
    })
}

export async function setUserPayCount() {
    Api.updateMany(USER_BUCKET, { bot: false, subscription_status: 'active' }, {
        $set: { available_play_count: 1 }
    })
}