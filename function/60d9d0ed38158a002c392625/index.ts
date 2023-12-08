import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

const ALERT_BUCKET = VARIABLE.BUCKET.ALERT;
const PAST_MATCH_BUCKET = VARIABLE.BUCKET.PAST_MATCH;

export async function checkPastMatch() {
    const now = new Date();
    const now2 = new Date();
    const db = await Api.useDatabase();

    const pastMachesCollection = db.collection(`bucket_${PAST_MATCH_BUCKET}`);

    const duel = await pastMachesCollection
        .find()
        .sort({ _id: -1 })
        .limit(1)
        .toArray()
        .catch(err => console.log("ERROR 4", err));

    if (duel[0].end_time > now.setMinutes(now.getMinutes() - 30)) {
        return
    }

    const lastAlert = await getLastAlert();
    if (
        !lastAlert ||
        (lastAlert && lastAlert.date < now2.setMinutes(now2.getMinutes() - 30))
    ) {
         Api.insertOne(ALERT_BUCKET, {
             title: "Bip 4Islem: WARNING!",
            message: "There have been no matches in 30 minutes!",
            date: new Date()
        })
    }

    return true;
}

async function getLastAlert() {
    const db = await Api.useDatabase();
    const alertCollection = db.collection(`bucket_${ALERT_BUCKET}`);
    return alertCollection
        .find()
        .sort({ _id: -1 })
        .limit(1)
        .toArray()
        .then(res => res[0])
        .catch(err => console.log("ERROR 5", err));
}