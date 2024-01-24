import * as Api from "../../655b4080c250ea002c7832a7/.build";
import { env as VARIABLE } from "../../655b40e8c250ea002c783322/.build";

const DUEL_INFO_BUCKET = VARIABLE.BUCKET.DUEL_INFO;
const SAYI_KRALI_DUEL_BUCKET = VARIABLE.BUCKET.SAYI_KRALI_DUEL;
const MAIN_SERVER_URL = VARIABLE.MAIN_SERVER_URL[VARIABLE.SERVICE.SAYI_KRALI];
const OPERATION_KEY = VARIABLE.OPERATION_KEY;

export async function checkFinishedDuels() {
    const db = await Api.useDatabase();

    const t = new Date();
    t.setSeconds(t.getSeconds() - 130);

    const finishedDuels = await db
        .collection(`bucket_${SAYI_KRALI_DUEL_BUCKET}`)
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
                user1_answers: duel.user1_answers,
                user2_answers: duel.user2_answers,
                user1_points: duel.user1_points,
                user2_points: duel.user2_points,
                start_time: Api.toObjectId(duelId).getTimestamp(),
                end_time: new Date(),
                player_type: duel.player_type,
            }

            if (duel.winner == 0) {
                httpRequest('insertPastMatchFromServer', duelData)
            } else {
                httpRequest('insertDeletedMatch', duelData)
            }

            httpRequest('removeServerInfoExternal', duel)

            removeIndetity(duelId)
            removeServerInfo(duelId)

            await db
                .collection(`bucket_${SAYI_KRALI_DUEL_BUCKET}`)
                .deleteOne({
                    _id: Api.toObjectId(duelId)
                })
                .catch(err => console.log("ERROR 8", err));
        }
    }

    const t2 = new Date();
    t2.setSeconds(t2.getSeconds() - 130);

    await db
        .collection(`bucket_${SAYI_KRALI_DUEL_BUCKET}`)
        .deleteMany({ created_at: { $lt: t2 } })
        .catch(err => console.log("ERROR 10", err));
}

async function httpRequest(functionName, duel) {
    await Api.httpRequest("post", `${MAIN_SERVER_URL}/fn-execute/${functionName}`, {
        duel: duel,
        key: OPERATION_KEY
    }, {}).catch(err => console.log("ERROR FETCH OPERATION", err));

    return true
}

async function removeIndetity(duel_id) {
    const db = await Api.useDatabase();
    await db.collection('identity').deleteMany({ "attributes.duel_id": duel_id })
        .catch(err => console.log("ERROR ", err))
}

async function removeServerInfo(duel_id) {
    const db = await Api.useDatabase();
    db.collection(`bucket_${DUEL_INFO_BUCKET}`).deleteOne({ duel_id })
}