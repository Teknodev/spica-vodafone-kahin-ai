import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as Helper from "../../633bf949956545002c9b7e31/.build";
import * as PmpEncryptDecrypt from "../../655cc56fc250ea002c78410f/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

const USER_POLICY = VARIABLE.USER_POLICY;
const USER_BUCKET = VARIABLE.BUCKET.USER;
const PASSWORD_SALT = VARIABLE.PASSWORD_SALT;

export async function login(req, res) {
    const { token } = req.body;

    if (!token) {
        return res.status(400).send({ message: "Token is required." });
    }

    const dectyptResult = PmpEncryptDecrypt.decryptToken(token);

    let identityData;
    try {
        identityData = await getIdentityToken(dectyptResult.msisdn)
    } catch (err) {
        return res.status(400).send({ message: "User is not found" });
    }

    if (!identityData) {
        return res.status(400).send({ message: "User is not found" });
    }

    const decodedToken = await Helper.getDecodedToken(identityData.token)

    const user = await Api.getOne(USER_BUCKET, { identity: String(decodedToken._id) })
        .catch(err => console.log("ERROR 2", err));

    return res.status(200).send({
        token: identityData.token,
        user: user,
        vodafoneToken: dectyptResult.token
    });
}

export async function register(req, res) {
    const { token } = req.body;

    if (!token) {
        return res.status(400).send({ message: "Token is required." });
    }

    const dectyptResult = PmpEncryptDecrypt.decryptToken(token);

    const msisdn = dectyptResult.msisdn;
    const identifier = dectyptResult.msisdn;

    const identityData = await createIdentity(identifier, msisdn)
        .catch(error => {
            if (error.message != 'Identity already exists.') {
                console.log("ERORR", error)
            }
            return res
                .status(400)
                .send({
                    message: "Error while creating identity",
                    error: error
                });
        });

    const insertedObject = await Api.insertOne(USER_BUCKET, {
        identity: identityData.identity_id,
        avatar_id: 0,
        created_at: new Date(),
        total_point: 0,
        range_point: 0,
        win_count: 0,
        lose_count: 0,
        total_award: 0,
        range_award: 0,
        available_play_count: 0,
        bot: false,
        perm_accept: false,
        free_play: false
    }).catch(console.error)

    if (!insertedObject) {
        return res.status(400).send({
            message:
                "Error while adding user to User Bucket (Identity already added).",
            error: error
        });
    }

    const user = insertedObject.ops[0];
    const indentityToken = await getIdentityToken(msisdn).catch(console.error)
    return res.status(200).send({
        token: indentityToken.token,
        user: user,
        vodafoneToken: dectyptResult.token
    });
}

function getIdentityToken(identifier) {
    const Identity = Api.useIdentity();
    return new Promise(async (resolve, reject) => {
        await Identity.login(identifier, PASSWORD_SALT)
            .then(data => {
                resolve({ token: data });
            })
            .catch(error => {
                reject(error);
            });
    });
}

function createIdentity(identifier, msisdn) {
    const Identity = Api.useIdentity();
    return new Promise(async (resolve, reject) => {
        await Identity.insert({
            identifier: identifier,
            password: PASSWORD_SALT,
            policies: [`${USER_POLICY}`],
            attributes: { msisdn }
        })
            .then(identity => {
                resolve({ identity_id: identity._id });
            })
            .catch(error => {
                console.log("ERROR 7", error);
                reject(error);
            });
    });
}

export async function userUpdate(req, res) {
    const { token, identity, name, avatar_id } = req.body;

    const decodedToken = await Helper.getDecodedToken(token)
    if (!decodedToken) {
        return res.status(400).send({ message: "Token is not verified." });
    }

    await Api.updateOne(USER_BUCKET, { identity: identity }, {
        $set: { name: name, avatar_id: avatar_id }
    }).catch(err => console.log("ERROR 2 ", err))

    return res.status(200).send({ message: "User updated successful" });
}

export function getRedirectURL() {
    return PmpEncryptDecrypt.getRedirectURL();
}
