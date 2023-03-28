import { database, ObjectId } from "@spica-devkit/database";
import fetch from 'node-fetch';

const DUEL_BUCKET = process.env.DUEL_BUCKET;
const MAIN_SERVER_URL = "https://bip-4islem-d6738.hq.spicaengine.com/api";
const OPERATION_KEY = '6Ww7PajcsGH34PbE';

let db;

export async function checkFinishedDuels() {
    if (!db) {
        db = await database().catch(err => console.log("ERROR 2", err));
    }

    const t = new Date();
    t.setSeconds(t.getSeconds() - 130);

    const finishedDuels = await db
        .collection(`bucket_${DUEL_BUCKET}`)
        .aggregate([
            {
                $match: {
                    $and: [{ created_at: { $exists: true } }, { created_at: { $lt: t } }]
                }
            }
        ])
        .toArray()
        .catch(async e => {
            console.log("ERROR 3", e);
        });

    if (finishedDuels.length) {
        for (let duel of finishedDuels) {
            let duelId = duel._id.toString();
            let duelData = {
                duel_id: duelId,
                name: duel.user1 + " vs " + duel.user2,
                user1: duel.user1,
                user2: duel.user2,
                winner: duel.winner,
                user1_points: duel.user1_points,
                user2_points: duel.user2_points,
                start_time: ObjectId(duelId).getTimestamp(),
                end_time: new Date(),
                user1_is_free: duel.user1_is_free,
                user2_is_free: duel.user2_is_free,
                duel_type: duel.duel_type,
            }

            if (duel.winner == 0) {
                fetchOperation('insertPastMatchFromServer', duelData)
            } else {
                fetchOperation('insertDeletedMatch', duelData)
            }

            fetchOperation('removeServerInfoExternal', duel)

            removeIndetity(duelId)

            await db
                .collection(`bucket_${DUEL_BUCKET}`)
                .deleteOne({
                    _id: ObjectId(duelId)
                })
                .catch(err => console.log("ERROR 8", err));
        }
    }

    const t2 = new Date();
    t2.setSeconds(t2.getSeconds() - 130);

    await db
        .collection(`bucket_${DUEL_BUCKET}`)
        .deleteMany({ created_at: { $lt: t2 }, last_food_eat_date: { $exists: false } })
        .catch(err => console.log("ERROR 10", err));
}

async function fetchOperation(functionName, duel) {
    await fetch(
        `${MAIN_SERVER_URL}/fn-execute/${functionName}`,
        {
            method: "post",
            body: JSON.stringify({
                duel: duel,
                key: OPERATION_KEY
            }),
            headers: {
                "Content-Type": "application/json",
            }
        }
    ).catch(err => console.log("ERROR FETCH OPERATION", err));

    return true
}

async function removeIndetity(duel_id) {
    if (!db) {
        db = await database().catch(err => console.log("ERROR ", err));
    }

    await db.collection('identity').deleteMany({ "attributes.duel_id": duel_id })
        .catch(err => console.log("ERROR ", err))
}
