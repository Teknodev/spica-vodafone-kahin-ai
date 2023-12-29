import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

const SERVER_INFO_BUCKET = VARIABLE.BUCKET.SERVER_INFO;

export async function clearServerInfoBucket() {
    const db = await Api.useDatabase();
    let date_1 = new Date();
    date_1.setMinutes(date_1.getMinutes() - 15);

    await db
        .collection(`bucket_${SERVER_INFO_BUCKET}`)
        .deleteMany({
            created_at: { $lt: date_1 }
        })
        .catch(e => console.log(e));

    return true;
}