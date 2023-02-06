import * as Api from "../../63b57559ebfd83002c5defe5/.build";
import * as Environment from "../../63b57e98ebfd83002c5df0c5/.build";

let jwt = require("jsonwebtoken");
const fetch = require("node-fetch");

const USER_POLICY = Environment.env.USER_POLICY;
const USER_BUCKET = Environment.env.BUCKET.USER;
const PASSWORD_SALT = Environment.env.FASTLOGIN.PASSWORD_SALT;
const FASTLOGIN_SECRET_KEY = Environment.env.FASTLOGIN.SECRET_KEY;
const FASTLOGIN_SERVICE_ID = Environment.env.FASTLOGIN.SERVICE_ID;

export async function login(req, res) {
    const db = await Api.useDatabase();
    const users_collection = db.collection(`bucket_${USER_BUCKET}`);

    const { token } = req.body;

    // 1-check token is defined
    if (token) {
        // 2-send token to get user information from Turkcell
        let fastlogin_response = await fastLogin(token).catch(err => console.log("ERROR 1", err));
        // let fastlogin_response = MOCK_RES;
        // 3-if response is error(node fetch send error as data)
        if (isResponseValid(fastlogin_response)) {
            let identifier = getIdentifier(fastlogin_response);
            let password = getPassword(fastlogin_response);
            let msisdn = fastlogin_response.msisdn;
            // 4-get identity
            getIdentityToken(identifier, password)
                .then(async data => {
                    // 4a-send response object back
                    let identity_token = data.token;
                    const decodedToken = jwt.decode(identity_token);

                    const user = await users_collection
                        .findOne({ identity: String(decodedToken._id) })
                        .catch(err => console.log("ERROR 2", err));

                    return res.status(200).send({
                        token: identity_token,
                        user: user
                    });
                })
                .catch(async error => {
                    // 4b-send response object back
                    // return res.status(200).send({
                    //     is_registered: false
                    // });

                    const identity_collection = db.collection(`identity`);
                    const user_identity = await identity_collection
                        .findOne({ "attributes.msisdn": msisdn })
                        .catch(err => console.log("ERROR 8", err));

                    if (user_identity) {
                        await identity_collection
                            .updateOne(
                                { _id: user_identity._id },
                                { $set: { identifier: identifier } }
                            )
                            .catch(err => console.log("ERROR 8", err));

                        const user = await users_collection
                            .findOne({ identity: String(user_identity._id) })
                            .catch(err => console.log("ERROR 2", err));

                        getIdentityToken(identifier, password).then(async data => {
                            return res.status(200).send({
                                token: data.token,
                                user: user
                            });
                        });
                    } else {
                        // 4-create an identity
                        createIdentity(identifier, password, msisdn)
                            .then(async identity_data => {
                                // 5-add this identity to user_bucket
                                let insertedObject = await users_collection
                                    .insertOne({
                                        identity: identity_data.identity_id,
                                        avatar_id: 0,
                                        elo: 0,
                                        created_at: new Date(),
                                        total_point: 0,
                                        weekly_point: 0,
                                        win_count: 0,
                                        lose_count: 0,
                                        total_award: 0,
                                        weekly_award: 0,
                                        available_play_count: 0,
                                        bot: false,
                                        free_play: false,
                                        perm_accept: false
                                    })
                                    .catch(error => {
                                        return res.status(400).send({
                                            message:
                                                "Error while adding user to User Bucket (Identity already added).",
                                            error: error
                                        });
                                    });

                                let user = insertedObject.ops[0];

                                getIdentityToken(identifier, password).then(async data => {
                                    return res.status(200).send({
                                        token: data.token,
                                        user: user
                                    });
                                });
                            })
                            .catch(error => {
                                return res
                                    .status(400)
                                    .send({
                                        message: "Error while creating identity",
                                        error: error
                                    });
                            });
                    }
                });
        } else {
            return res.status(400).send({ message: "Fastlogin error", error: fastlogin_response });
        }
    } else {
        return res.status(400).send({ message: "Fastlogin token is not defined." });
    }
}

// register

export async function register(req, res) {
    const db = await Api.useDatabase();
    const { identity, name, avatar_id } = req.body;

    const users_collection = db.collection(`bucket_${USER_BUCKET}`);
    if (name) {
        let user = await users_collection
            .findOne({ identity: identity })
            .catch(err => console.log("ERROR 4", err));

        if (user) {
            let userData = await users_collection
                .findOneAndUpdate(
                    { _id: Api.toObjectId(user._id) },
                    {
                        $set: {
                            name: name,
                            avatar_id: avatar_id
                        }
                    }
                )
                .catch(err => console.log("ERROR 5", err));

            return userData.value;
        } else {
            return res.status(400).send({ message: "Can't find the user" });
        }
    } else {
        return res.status(400).send({ message: "Name or url is not defined." });
    }
}

// FASTLOGIN - give token - get all user information
async function fastLogin(token) {
    let body = {
        serviceId: FASTLOGIN_SERVICE_ID,
        secretKey: `${FASTLOGIN_SECRET_KEY}`,
        loginToken: token
    };

    return await fetch("https://fastlogin.com.tr/fastlogin_app/secure/validate.json", {
        method: "post",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" }
    })
        .then(res => res.json())
        .catch(err => console.log("ERROR 5", err));
}

// get identity token(login to spica) with identifier and password
function getIdentityToken(identifier, password) {
    const Identity = Api.useIdentity();
    return new Promise(async (resolve, reject) => {
        await Identity.login(identifier, password)
            .then(data => {
                resolve({ token: data });
            })
            .catch(error => {
                //console.log("ERROR! Error occur while getting identity token", error);
                // console.log("ERROR 6", error);
                reject(error);
            });
    });
}

// create identity(register to spica) with identifier and password
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

// helper functions
function isResponseValid(response) {
    let is_valid = false;
    if (response.msisdn != null && response.accountId != null) {
        is_valid = true;
    }
    return is_valid;
}

function getIdentifier(response) {
    let identifier = response.accountId;

    return identifier;
}

function getPassword(response) {
    let unique_password = PASSWORD_SALT;

    return unique_password;
}

export async function getMyIp(req, res) {
    const test = await fetch("https://api.ipify.org?format=json", {
        method: "get"
    })
        .then(res => res.json())
        .catch(err => console.log("ERROR 5", err));

    console.log("test", test)

    return res.status(200).send({ message: 'ok' })
}