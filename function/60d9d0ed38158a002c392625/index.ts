import { database, ObjectId } from "@spica-devkit/database";

const DUEL_BUCKET_ID = process.env.DUEL_BUCKET_ID;
const ALERT_BUCKET_ID = process.env.ALERT_BUCKET_ID;
const PAST_MATCHES_BUCKET_ID = process.env.PAST_MATCHES_BUCKET_ID;

let db;

export async function duelHighLoads() {
    if (!db) {
        db = await database().catch(err => console.log("ERROR 1", err));
    }

    let now2 = new Date();

    const duelCollection = db.collection(`bucket_${DUEL_BUCKET_ID}`);
    const alertCollection = db.collection(`bucket_${ALERT_BUCKET_ID}`);

    const duels = await duelCollection
        .find({ is_finished: { $exists: false } })
        .toArray()
        .catch(err => console.log("ERROR 2", err));

    if (duels.length == 50) {
        const lastAlert = await alertCollection
            .find()
            .sort({ _id: -1 })
            .limit(1)
            .toArray()
            .catch(err => console.log("ERROR 8", err));

        if (
            !lastAlert[0] ||
            (lastAlert[0] && lastAlert[0].date < now2.setMinutes(now2.getMinutes() - 10))
        ) {
            await alertCollection
                .insertOne({
                    title: "Math: Duel High Loads",
                    message: "The number of duels has been achieved to 50",
                    date: new Date()
                })
                .catch(err => {
                    console.log("Error 7", err);
                });
        }
    }
    return true;
}

export async function checkPastMatch() {
    let now = new Date();
    let now2 = new Date();
    if (!db) {
        db = await database().catch(err => console.log("ERROR 3", err));
    }

    const pastMachesCollection = db.collection(`bucket_${PAST_MATCHES_BUCKET_ID}`);
    const alertCollection = db.collection(`bucket_${ALERT_BUCKET_ID}`);

    const duel = await pastMachesCollection
        .find()
        .sort({ _id: -1 })
        .limit(1)
        .toArray()
        .catch(err => console.log("ERROR 4", err));

    if (duel[0].end_time < now.setMinutes(now.getMinutes() - 10)) {
        const lastAlert = await alertCollection
            .find()
            .sort({ _id: -1 })
            .limit(1)
            .toArray()
            .catch(err => console.log("ERROR 5", err));

        if (
            !lastAlert[0] ||
            (lastAlert[0] && lastAlert[0].date < now2.setMinutes(now2.getMinutes() - 10))
        ) {
            await alertCollection
                .insertOne({
                    title: "Math: WARNING!",
                    message: "There have been no matches in 10 minutes!",
                    date: new Date()
                })
                .catch(err => {
                    console.log("ERROR 6: ", err);
                });
        }
    }
    return true;
}


export async function detectInterruptedGame(req, res) {
    if (!db) {
        db = await database().catch(err => console.log("ERROR 3", err));
    }
    let now = new Date();
    let date1 = now.setMinutes(now.getMinutes() - 10);

    let dateFilter = {
        $gte: new Date("12-26-2022 13:00"),
        $lte: new Date("12-26-2022 13:10"),
    }

    const pastMatchesCollection = db.collection(`bucket_${PAST_MATCHES_BUCKET_ID}`);
    const matches = await pastMatchesCollection.find({ start_time: dateFilter }).toArray().catch(console.error);

    matches.forEach(match => {
        checkMatchesActions(1, match);
        if (match.duel_type == 0) {
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
        const seconds = differenceBetweenDates(lastAction, firstAction);
        if (seconds > 0 && seconds < 75) {
            console.log(`MATCH-USER-${userOrder}: ${seconds} - `, match)
        }
    }
}

function differenceBetweenDates(date1, date2) {
    const date1Seconds = Math.floor(new Date(date1).getTime() / 1000);
    const date2Seconds = Math.floor(new Date(date2).getTime() / 1000);
    return date1Seconds - date2Seconds;
}
