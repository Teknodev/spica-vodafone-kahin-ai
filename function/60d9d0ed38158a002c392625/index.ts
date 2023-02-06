import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as Environment from "../../63b57e98ebfd83002c5df0c5/.build";
import * as Helper from "../../633bf949956545002c9b7e31/.build";

const DUEL_BUCKET = Environment.env.BUCKET.DUEL;
const ALERT_BUCKET = Environment.env.BUCKET.ALERT;
const PAST_MATCH_BUCKET = Environment.env.BUCKET.PAST_MATCH;


export async function duelHighLoads() {
    const now2 = new Date();
    const duels = Api.getMany(DUEL_BUCKET, { is_finished: { $exists: false } })

    if (duels.length != 50) {
        return;
    }

    const lastAlert = await getLastAlert();
    if (
        !lastAlert ||
        (lastAlert && lastAlert.date < now2.setMinutes(now2.getMinutes() - 10))
    ) {
        Api.insertOne(ALERT_BUCKET, {
            title: "Math: Duel High Loads",
            message: "The number of duels has been achieved to 50",
            date: new Date()
        })
    }

    return;
}

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

    if (duel[0].end_time > now.setMinutes(now.getMinutes() - 10)) {
        return
    }

    const lastAlert = await getLastAlert();
    if (
        !lastAlert ||
        (lastAlert && lastAlert.date < now2.setMinutes(now2.getMinutes() - 10))
    ) {
         Api.insertOne(ALERT_BUCKET, {
             title: "Math: WARNING!",
            message: "There have been no matches in 10 minutes!",
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

export async function detectInterruptedGame(req, res) {
    const db = await Api.useDatabase();
    let now = new Date();
    let date1 = now.setMinutes(now.getMinutes() - 10);

    let dateFilter = {
        $gte: new Date("12-26-2022 13:00"),
        $lte: new Date("12-26-2022 13:10"),
    }

    const pastMatchesCollection = db.collection(`bucket_${PAST_MATCH_BUCKET}`);
    const matches = await pastMatchesCollection.find({ start_time: dateFilter }).toArray().catch(console.error);

    matches.forEach(match => {
        checkMatchesActions(1, match);
        if (match.player_type == 0) {
            checkMatchesActions(2, match);
        }
    })

    return res.status(200).send({ message: 'ok' })
}

function checkMatchesActions(userOrder, match) {
    if (match[`user${userOrder}_answers`] && typeof match[`user${userOrder}_answers`] != "null") {
        let firstAction, lastAction;
        try {
            firstAction = JSON.parse(match[`user${userOrder}_answers`][0]).date
            lastAction = JSON.parse(match[`user${userOrder}_answers`][match[`user${userOrder}_answers`].length - 1]).date
        } catch (err) { }
        const seconds = Helper.differenceBetweenDates(lastAction, firstAction);
        if (seconds > 0 && seconds < 75) {
            console.log(`MATCH-USER-${userOrder}: ${seconds} - `, match)
        }
    }
}
