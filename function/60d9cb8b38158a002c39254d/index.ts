import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as Helper from "../../633bf949956545002c9b7e31/.build";
import * as PmpEncryptDecrypt from "../../655cc56fc250ea002c78410f/.build";
import * as Sms from "../../65957905073c73002bdb600b/.build";
import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

const USER_POLICY = VARIABLE.USER_POLICY;
const USER_BUCKET = VARIABLE.BUCKET.USER;

export async function login(req, res) {
    const { msisdn, password } = req.body;

    if (!msisdn || !password) {
        return res.status(400).send({ message: "Msisdn and password are required." });
    }

    let identityData;
    try {
        identityData = await getIdentityToken(msisdn, password)
    } catch (err) {
        return res.status(400).send({ status_code: 2 });
    }

    const decodedToken = await Helper.getDecodedToken(identityData.token)

    const user = await Api.getOne(USER_BUCKET, { identity: String(decodedToken._id) })
        .catch(err => console.log("ERROR 2", err));

    return res.status(200).send({
        token: identityData.token,
        user: user,
    });
}

export async function register(req, res) {
    const { token } = req.body;

    if (!token) {
        return res.status(400).send({ status_code: 3 });
    }

    const dectyptResult = PmpEncryptDecrypt.decryptToken(token);
    // const dectyptResult = {
    //     msisdn: "905530129507"
    // }

    const msisdn = dectyptResult.msisdn;
    if (!msisdn) {
        return res.status(400).send({ status_code: 1 });
    }

    const identifier = dectyptResult.msisdn;

    const Identity = Api.useIdentity();
    let [identityData] = await Identity.getAll({ filter: { identifier } });
    if (identityData) {
        return res.status(400).send({ status_code: 4 });
    }

    let password = codeGenerate(6);

    identityData = await Identity.insert({
        identifier,
        password,
        policies: [`${USER_POLICY}`],
        attributes: { msisdn }
    }).catch(console.error)

    if (!identityData) {
        return res.status(400).send({ status_code: 1 });
    }

    Sms.sendPassword(msisdn, password);

    const insertedObject = await Api.insertOne(USER_BUCKET, {
        identity: String(identityData._id),
        avatar_id: 0,
        created_at: new Date(),
        total_point: 0,
        range_point: 0,
        win_count: 0,
        lose_count: 0,
        total_award: 0,
        range_award: 0,
        available_play_count: 1,
        bot: false,
        perm_accept: false,
        free_play: false
    }).catch(console.error)

    if (!insertedObject) {
        return res.status(400).send({ status_code: 1 });
    }

    const user = insertedObject.ops[0];
    const indentityToken = await getIdentityToken(msisdn, password).catch(console.error)
    return res.status(200).send({
        token: indentityToken.token,
        user: user,
    });
}

function getIdentityToken(identifier, password) {
    const Identity = Api.useIdentity();
    return new Promise(async (resolve, reject) => {
        await Identity.login(identifier, password)
            .then(data => {
                resolve({ token: data });
            })
            .catch(error => {
                reject(error);
            });
    });
}

export async function userUpdate(req, res) {
    const { token, identity, name, avatarId } = req.body;

    const decodedToken = await Helper.getDecodedToken(token)
    if (!decodedToken) {
        return res.status(400).send({ message: "Token is not verified." });
    }

    await Api.updateOne(USER_BUCKET, { identity: identity }, {
        $set: { name: name, avatar_id: avatarId }
    }).catch(err => console.log("ERROR 2 ", err))

    return res.status(200).send({ message: "User updated successful" });
}

export function getRedirectURL() {
    return PmpEncryptDecrypt.getRedirectURL();
}

function codeGenerate(length) {
    let result = "";
    let characters = "123456789";
    let charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

export async function resetPassword(req, res) {
    const { msisdn } = req.body;

    if (!msisdn) {
        return res.status(400).send({ status_code: 6 });
    }

    const Identity = Api.useIdentity();
    const [indentity] = await Identity.getAll({ filter: { identifier: msisdn } }).catch(console.error);
    if (!indentity) {
        return res.status(400).send({ status_code: 7 });
    }

    let password = codeGenerate(6);
    let updatedIdentity = {
        identifier: indentity.identifier,
        password,
        attributes: indentity.attributes,
        policies: indentity.policies,
    }

    const identityData = await Identity.update(indentity._id, updatedIdentity).catch(console.error)
    if (!identityData) {
        return res.status(400).send({ status_code: 1 });
    }

    Sms.sendPassword(indentity.identifier, password);

    return res.status(200).send("success");
}

export async function smsFlowRegister(msisdn) {
    const identifier = msisdn;

    const Identity = Api.useIdentity();
    let [identityData] = await Identity.getAll({ filter: { identifier } });
    if (identityData) {
        return res.status(400).send({ status_code: 4 });
    }

    let password = codeGenerate(6);

    identityData = await Identity.insert({
        identifier,
        password,
        policies: [`${USER_POLICY}`],
        attributes: { msisdn }
    }).catch(console.error)

    if (!identityData) {
        return res.status(400).send({ status_code: 1 });
    }

    Sms.sendPassword(msisdn, password);

    await Api.insertOne(USER_BUCKET, {
        identity: String(identityData._id),
        avatar_id: 0,
        created_at: new Date(),
        total_point: 0,
        range_point: 0,
        win_count: 0,
        lose_count: 0,
        total_award: 0,
        range_award: 0,
        available_play_count: 1,
        bot: false,
        perm_accept: false,
        free_play: false
    }).catch(console.error)

    return;
}