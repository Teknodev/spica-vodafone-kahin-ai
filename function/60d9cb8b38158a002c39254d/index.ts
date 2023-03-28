import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as Environment from "../../63b57e98ebfd83002c5df0c5/.build";
import * as Helper from "../../633bf949956545002c9b7e31/.build";

const USER_POLICY = Environment.env.USER_POLICY;
const USER_BUCKET = Environment.env.BUCKET.USER;
const PASSWORD_SALT = Environment.env.PASSWORD_SALT;

export async function fastLogin(req, res) {
    const db = await Api.useDatabase();
    const { no } = req.body;

    if (!no) {
        return res.status(400).send({ message: "Msisdn is required." });
    }

    let identifier = no;
    let password = PASSWORD_SALT;
    let msisdn = no;

    let identityData;
    try {
        identityData = await getIdentityToken(identifier, password)
    } catch (err) {
        const identityCollection = db.collection(`identity`);
        const userIdentity = await identityCollection
            .findOne({ "attributes.msisdn": msisdn })
            .catch(err => console.log("ERROR 8", err));

        if (!userIdentity) {
            return res.status(400).send({ message: "User is not found" });
        }

        await identityCollection
            .updateOne(
                { _id: userIdentity._id },
                { $set: { identifier: identifier } }
            )
            .catch(err => console.log("ERROR 8", err));

        const user = await Api.getOne(USER_BUCKET, { identity: String(userIdentity._id) })
            .catch(err => console.log("ERROR 2", err));

        const newIdentityData = await getIdentityToken(identifier, password)
        if (newIdentityData) {
            return res.status(400).send({ message: "User is not found" });
        }
        return res.status(200).send({
            token: data.token,
            user: user
        });
    }

    if (!identityData) {
        return res.status(400).send({ message: "User is not found" });
    }

    const decodedToken = await Helper.getDecodedToken(identityData.token)

    const user = await Api.getOne(USER_BUCKET, { identity: String(decodedToken._id) })
        .catch(err => console.log("ERROR 2", err));

    return res.status(200).send({
        token: identityData.token,
        user: user
    });
}

export async function fastRegister(req, res) {
    const { msisdn } = req.body;

    if (!msisdn) {
        return res.status(400).send({ message: "Msisdn is required." });
    }

    const identityData = await createIdentity(msisdn, PASSWORD_SALT, msisdn)
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
        weekly_point: 0,
        win_count: 0,
        lose_count: 0,
        total_award: 0,
        weekly_award: 0,
        available_play_count: 50,
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
    const indentityToken = await getIdentityToken(msisdn, PASSWORD_SALT).catch(console.error)
    return res.status(200).send({
        token: indentityToken.token,
        user: user
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

function createIdentity(identifier, password, msisdn) {
    const Identity = Api.useIdentity();
    return new Promise(async (resolve, reject) => {
        await Identity.insert({
            identifier: identifier,
            password: password,
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

export async function fastUserUpdate(req, res) {
    const { identity, name, avatar_id } = req.body;

    const token = Helper.getTokenByReq(req);
    const decodedToken = await Helper.getDecodedToken(token)
    if (!decodedToken) {
        return res.status(400).send({ message: "Token is not verified." });
    }

    await Api.updateOne(USER_BUCKET, { identity: identity }, {
        $set: { name: name, avatar_id: avatar_id }
    }).catch(err => console.log("ERROR 2 ", err))

    return res.status(200).send({ message: "User updated successful" });
}