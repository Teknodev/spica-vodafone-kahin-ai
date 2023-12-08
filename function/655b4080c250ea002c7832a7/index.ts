import * as Environment from "../../655b40e8c250ea002c783322/.build";

import * as Bucket from "@spica-devkit/bucket"
import * as Identity from "@spica-devkit/identity";
import { database, ObjectId } from "@spica-devkit/database";
import axios from 'axios';

const SECRET_API_KEY = Environment.env.SECRET_API_KEY;

export function useBucket(initializeParams = { apikey: SECRET_API_KEY }) {
    Bucket.initialize(initializeParams);
    return Bucket;
}

export function useIdentity(initializeParams = { apikey: SECRET_API_KEY }) {
    Identity.initialize(initializeParams);
    return Identity;
}

export async function useDatabase() {
    const db = await database().catch(err => console.log("Error Use Database: ", err));
    return db;
}

export function toObjectId(value) {
    return ObjectId(value);
}

export async function httpRequest(method, url, data = {}, headers) {
    let axiosParams = { method, url, data };
    if (method == 'get' && Object.keys(data).length) {
        delete axiosParams['data']
        axiosParams['params'] = data;
    }

    if (headers) {
        axiosParams['headers'] = headers;
    }

    return axios(axiosParams);
}

export async function getIdentityByMsisdn(msisdn) {
    const Identity = useIdentity();
    return Identity.getAll({
        filter: { "attributes.msisdn": String(msisdn) }
    });
}

export async function getCount(bucketId) {
    const db = await useDatabase();
    return db.collection(`bucket_${bucketId}`)
        .count()
        .catch(err => console.log("ERROR 1", err));
}

export async function getCountByFilter(bucketId, filter) {
    const db = await useDatabase();
    return db.collection(`bucket_${bucketId}`)
        .find(filter)
        .count()
        .catch(err => console.log("ERROR 1", err));
}

export async function getOne(bucketId, filter) {
    const db = await useDatabase();
    return db.collection(`bucket_${bucketId}`)
        .findOne(filter)
        .catch(err => console.log("ERROR 1", err));
}

export async function getMany(bucketId, filter) {
    const db = await useDatabase();
    return db.collection(`bucket_${bucketId}`)
        .find(filter)
        .toArray()
        .catch(err => console.log("ERROR 1", err));
}

export async function updateOne(bucketId, filter, update) {
    const db = await useDatabase();
    return db.collection(`bucket_${bucketId}`)
        .updateOne(filter, update)
        .catch(err => console.log("ERROR 1", err));
}

export async function updateMany(bucketId, filter, update) {
    const db = await useDatabase();
    return db.collection(`bucket_${bucketId}`)
        .updateMany(filter, update)
        .catch(err => console.log("ERROR 1", err));
}

export async function insertOne(bucketId, data) {
    const db = await useDatabase();
    return db.collection(`bucket_${bucketId}`)
        .insertOne(data)
        .catch(err => console.log("ERROR 1", err));
}

export async function insertMany(bucketId, data) {
    const db = await useDatabase();
    return db.collection(`bucket_${bucketId}`)
        .insertMany(data)
        .catch(err => console.log("ERROR 1", err));
}

export async function deleteOne(bucketId, filter) {
    const db = await useDatabase();
    return db.collection(`bucket_${bucketId}`)
        .deleteOne(filter)
        .catch(err => console.log("ERROR 1", err));
}

export async function deleteMany(bucketId, filter) {
    const db = await useDatabase();
    return db.collection(`bucket_${bucketId}`)
        .deleteMany(filter)
        .catch(err => console.log("ERROR 1", err));
}