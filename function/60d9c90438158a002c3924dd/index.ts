import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as Environment from "../../63b57e98ebfd83002c5df0c5/.build";

const USER_BUCKET = Environment.env.BUCKET.USER;
const CONFIRMATION_CODE_BUCKET = Environment.env.BUCKET.CONFIRMATION_CODE;

export async function clearUserPoint() {
    Api.updateMany(USER_BUCKET, {}, {
        $set: { weekly_point: 0, weekly_award: 0 }
    })
}

export async function clearBotPoint() {
    Api.updateMany(USER_BUCKET, { bot: true }, {
        $set: { weekly_point: 0, total_point: 0 }
    })
}

export async function updateConfirmCode() {
    let date = new Date()
    date.setMinutes(date.getMinutes() - 2)

    Api.updateMany(CONFIRMATION_CODE_BUCKET, {
        sent_date: { $lt: date },
        $or: [{ is_expired: false }, { is_expired: { $exists: false } }]
    }, { $set: { is_expired: true } })
}