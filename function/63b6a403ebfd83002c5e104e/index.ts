import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

const USER_BUCKET = VARIABLE.BUCKET.USER;

export async function getByMsisdn(msisdn) {
    const db = await Api.useDatabase();
    const identity = await db.collection('identity')
        .findOne({ "attributes.msisdn": msisdn })
    if (!identity) return;
    return getByIdentityId(String(identity._id));
}

export async function getByIdentityId(identityId) {
    const db = await Api.useDatabase();
    return db.collection(`bucket_${USER_BUCKET}`)
        .findOne({ identity: identityId })
        .catch(err => console.log("ERROR 1", err));
}

export async function getCountByFilter(filter) {
    const db = await Api.useDatabase();
    return db.collection(`bucket_${USER_BUCKET}`)
        .find(filter)
        .count()
        .catch(err => console.log("ERROR 1", err));
}

export async function getMany(filter) {
    const db = await Api.useDatabase();
    return db.collection(`bucket_${USER_BUCKET}`)
        .find(filter)
        .toArray()
        .catch(err => console.log("ERROR 1", err));
}

export async function getOne(filter) {
    const db = await Api.useDatabase();
    return db.collection(`bucket_${USER_BUCKET}`)
        .findOne(filter)
        .catch(err => console.log("ERROR 1", err));
}

export async function updateOne(filter, update) {
    const db = await Api.useDatabase();
    return db.collection(`bucket_${USER_BUCKET}`)
        .updateOne(filter, update)
        .catch(err => console.log("ERROR 1", err));
}

export async function updateMany(filter, update) {
    const db = await Api.useDatabase();
    return db.collection(`bucket_${USER_BUCKET}`)
        .updateMany(filter, update)
        .catch(err => console.log("ERROR 1", err));
}
